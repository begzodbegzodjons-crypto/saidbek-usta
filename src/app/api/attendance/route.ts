import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/attendance?date=&from=&to=&siteId=&workerId=
export async function GET(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const siteId = searchParams.get('siteId')
    const workerId = searchParams.get('workerId')

    const where: Record<string, unknown> = {}
    if (date) where.date = date
    if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, string>).gte = from
      if (to) (where.date as Record<string, string>).lte = to
    }
    if (siteId) where.siteId = siteId
    if (workerId) where.workerId = workerId

    const records = await db.attendance.findMany({
      where,
      include: {
        worker: { select: { id: true, fullName: true, position: true, dailyRate: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error('GET /api/attendance error:', error)
    return NextResponse.json({ error: 'Davomatni olishda xatolik' }, { status: 500 })
  }
}

// POST /api/attendance — ommaviy saqlash (bitta tranzaksiyada, yarmi saqlanmaydi)
// body: { date, siteId?, entries: [{ workerId, status, siteId?, dayRate?, note? }] }
// Har bir yozuv O'Z obyektiga ega bo'lishi mumkin (ishchini shu kunda qaysi
// obyektga yuborilgani belgilanadi). entry.siteId yo'q bo'lsa body.siteId ishlatiladi.
interface AttendanceEntry {
  workerId?: unknown
  status?: unknown
  siteId?: unknown
  dayRate?: unknown
  note?: unknown
}

export async function POST(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const body = await request.json()
    const date = String(body.date ?? '').trim()
    const defaultSiteId = String(body.siteId ?? '').trim()
    const entries = (Array.isArray(body.entries) ? body.entries : []) as AttendanceEntry[]

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Sana noto'g'ri formatda" }, { status: 400 })
    }

    // Kirish ma'lumotlarini oldindan tekshirish (tranzaksiyadan tashqarida)
    const prepared: {
      workerId: string
      status: 'PRESENT' | 'ABSENT'
      siteId: string
      dayRate: number | null
      note: string | null
    }[] = []
    const workerIds = [
      ...new Set(entries.map((e) => String(e.workerId ?? '')).filter((v): v is string => v !== '')),
    ]
    const workers = await db.worker.findMany({ where: { id: { in: workerIds } }, select: { id: true } })
    const validWorkerIds = new Set(workers.map((w) => w.id))

    // Barcha ishlatilgan obyekt idlarini yig'ib, mavjudligini tekshirish
    const siteIds = new Set<string>()
    for (const entry of entries) {
      const sid = String(entry.siteId ?? defaultSiteId).trim()
      if (sid) siteIds.add(sid)
    }
    if (siteIds.size === 0) {
      return NextResponse.json({ error: 'Obyekt tanlanmagan' }, { status: 400 })
    }
    const siteRows = await db.site.findMany({ where: { id: { in: [...siteIds] } }, select: { id: true } })
    const validSiteIds = new Set(siteRows.map((s) => s.id))

    for (const entry of entries) {
      const workerId = String(entry.workerId ?? '')
      const status = entry.status === 'ABSENT' ? 'ABSENT' : entry.status === 'PRESENT' ? 'PRESENT' : null
      const entrySiteId = String(entry.siteId ?? defaultSiteId).trim()
      if (!workerId || !status || !validWorkerIds.has(workerId)) continue
      if (!entrySiteId || !validSiteIds.has(entrySiteId)) continue
      let dayRate: number | null = null
      if (entry.dayRate !== undefined && entry.dayRate !== null && entry.dayRate !== '') {
        const r = Number(entry.dayRate)
        if (!isNaN(r) && r >= 0) dayRate = r
      }
      prepared.push({
        workerId,
        status,
        siteId: entrySiteId,
        dayRate,
        note: entry.note ? String(entry.note).trim() || null : null,
      })
    }

    // Barcha yozuvlar BITTA partiyalangan tranzaksiyada — 10 ta telefon bir vaqtda
    // kirsa ham yarmi saqlanib qolish yoki ma'lumot yo'qolish imkonsiz.
    // Batch (array) shakli: barcha upsert'lar bitta bog'lanishda partiyalab yuboriladi —
    // connection_limit=1 bilan eng tez va ishonchli usul (interaktiv shakl konkurensiyada qotadi)
    await db.$transaction(
      prepared.map((p) =>
        db.attendance.upsert({
          where: { workerId_date: { workerId: p.workerId, date } },
          create: { workerId: p.workerId, siteId: p.siteId, date, status: p.status, dayRate: p.dayRate, note: p.note },
          update: { siteId: p.siteId, status: p.status, dayRate: p.dayRate, note: p.note },
        })
      ),
      // Batch shaklning Prisma tipi faqat isolationLevel'ni ko'rsatadi, ammo
      // runtime timeout/maxWait'ni qabul qiladi (baza band bo'lsa ham 30s kutadi)
      { timeout: 30_000, maxWait: 30_000 } as Parameters<typeof db.$transaction>[1]
    )

    return NextResponse.json({ ok: true, saved: prepared.length, total: entries.length })
  } catch (error) {
    console.error('POST /api/attendance error:', error)
    return NextResponse.json(
      { error: 'Saqlashda xatolik — qayta urinib ko\u2018ring (ma\u2019lumotlar buzilmagan)' },
      { status: 500 }
    )
  }
}
