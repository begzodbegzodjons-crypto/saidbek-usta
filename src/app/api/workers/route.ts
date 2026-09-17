import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/workers — barcha ishchilar + hisob-kitob (ishlagan puli, olgani, qoldiq)
export async function GET(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim().toLowerCase()
    const statusFilter = searchParams.get('status') // 'active' | 'inactive' | null

    const workers = await db.worker.findMany({
      where: statusFilter === 'active' ? { active: true } : statusFilter === 'inactive' ? { active: false } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    const attendances = await db.attendance.findMany({
      where: { status: 'PRESENT' },
      select: { workerId: true, dayRate: true, worker: { select: { dailyRate: true } } },
    })
    const payments = await db.payment.groupBy({
      by: ['workerId'],
      _sum: { amount: true },
    })

    const earnedMap: Record<string, number> = {}
    const daysMap: Record<string, number> = {}
    for (const a of attendances) {
      earnedMap[a.workerId] = (earnedMap[a.workerId] ?? 0) + (a.dayRate ?? a.worker.dailyRate ?? 0)
      daysMap[a.workerId] = (daysMap[a.workerId] ?? 0) + 1
    }
    const paidMap: Record<string, number> = {}
    for (const p of payments) {
      paidMap[p.workerId] = p._sum.amount ?? 0
    }

    let result = workers.map((w) => {
      const earned = earnedMap[w.id] ?? 0
      const paid = paidMap[w.id] ?? 0
      return {
        ...w,
        daysWorked: daysMap[w.id] ?? 0,
        earned,
        paid,
        balance: earned - paid,
      }
    })

    if (search) {
      result = result.filter(
        (w) =>
          w.fullName.toLowerCase().includes(search) ||
          (w.phone ?? '').toLowerCase().includes(search) ||
          (w.position ?? '').toLowerCase().includes(search)
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/workers error:', error)
    return NextResponse.json({ error: 'Ishchilarni olishda xatolik' }, { status: 500 })
  }
}

// POST /api/workers — yangi ishchi
export async function POST(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const body = await request.json()
    const fullName = (body.fullName ?? '').trim()
    if (!fullName) {
      return NextResponse.json({ error: 'Ism-familiya majburiy' }, { status: 400 })
    }
    const dailyRate = Number(body.dailyRate)
    if (body.dailyRate !== undefined && body.dailyRate !== null && body.dailyRate !== '' && (isNaN(dailyRate) || dailyRate < 0)) {
      return NextResponse.json({ error: "Kunlik haq noto'g'ri kiritilgan" }, { status: 400 })
    }

    // Idempotent yaratish: aynan shu so'rov allaqachon saqlangan bo'lsa (aynan shu clientKey),
    // yangi yozuv yaratilmaydi — mavjud yozuv qaytariladi (telefonlarda qayta urinish xavfsiz)
    const clientKey = typeof body.clientKey === 'string' ? body.clientKey.trim().slice(0, 64) : ''
    if (clientKey) {
      const existing = await db.worker.findUnique({ where: { clientKey } })
      if (existing) return NextResponse.json(existing)
    }

    const worker = await db.worker.create({
      data: {
        fullName,
        phone: (body.phone ?? '').trim() || null,
        position: (body.position ?? '').trim() || null,
        dailyRate: isNaN(dailyRate) ? 0 : dailyRate,
        active: body.active !== false,
        clientKey: clientKey || null,
      },
    })
    return NextResponse.json(worker, { status: 201 })
  } catch (error) {
    console.error('POST /api/workers error:', error)
    return NextResponse.json({ error: "Ishchi qo'shishda xatolik" }, { status: 500 })
  }
}
