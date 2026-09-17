import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/transactions?siteId=&type=&from=&to= — obyekt moliyasi (avans va xarajatlar)
export async function GET(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get('siteId')
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = {}
    if (siteId) where.siteId = siteId
    if (type === 'ADVANCE' || type === 'EXPENSE') where.type = type
    if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, string>).gte = from
      if (to) (where.date as Record<string, string>).lte = to
    }

    const [transactions, sites] = await Promise.all([
      db.siteTransaction.findMany({
        where,
        include: { site: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      db.site.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ])

    // Umumiy summalari
    let totalAdvance = 0
    let totalExpense = 0
    const bySiteMap: Record<string, { siteId: string; siteName: string; advance: number; expense: number }> = {}
    for (const t of transactions) {
      if (t.type === 'ADVANCE') totalAdvance += t.amount
      else totalExpense += t.amount
      if (!bySiteMap[t.siteId]) {
        bySiteMap[t.siteId] = { siteId: t.siteId, siteName: t.site.name, advance: 0, expense: 0 }
      }
      if (t.type === 'ADVANCE') bySiteMap[t.siteId].advance += t.amount
      else bySiteMap[t.siteId].expense += t.amount
    }
    const bySite = Object.values(bySiteMap).sort((a, b) => b.advance + b.expense - (a.advance + a.expense))

    return NextResponse.json({ transactions, totalAdvance, totalExpense, bySite, sites })
  } catch (error) {
    console.error('GET /api/transactions error:', error)
    return NextResponse.json({ error: "Moliyani olishda xatolik" }, { status: 500 })
  }
}

// POST /api/transactions — yangi avans yoki xarajat
export async function POST(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const body = await request.json()
    const siteId = String(body?.siteId ?? '').trim()
    const type = body?.type === 'ADVANCE' ? 'ADVANCE' : 'EXPENSE'
    const amount = Number(body?.amount)
    const date = String(body?.date ?? '').trim()
    const category = String(body?.category ?? '').trim() || null
    const note = String(body?.note ?? '').trim() || null

    if (!siteId) {
      return NextResponse.json({ error: 'Obyektni tanlang' }, { status: 400 })
    }
    const site = await db.site.findUnique({ where: { id: siteId } })
    if (!site) {
      return NextResponse.json({ error: 'Obyekt topilmadi' }, { status: 400 })
    }
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Summa 0 dan katta bo'lishi kerak" }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Sana noto'g'ri formatda" }, { status: 400 })
    }

    // Idempotent yaratish — aynan shu so'rov saqlangan bo'lsa, pul/yozuv IKKI MARTA yozilmaydi
    const clientKey = typeof body?.clientKey === 'string' ? body.clientKey.trim().slice(0, 64) : ''
    if (clientKey) {
      const existing = await db.siteTransaction.findUnique({
        where: { clientKey },
        include: { site: { select: { id: true, name: true } } },
      })
      if (existing) return NextResponse.json(existing)
    }

    const created = await db.siteTransaction.create({
      data: { siteId, type, amount, date, category, note, clientKey: clientKey || null },
      include: { site: { select: { id: true, name: true } } },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('POST /api/transactions error:', error)
    return NextResponse.json({ error: "Qo'shishda xatolik" }, { status: 500 })
  }
}
