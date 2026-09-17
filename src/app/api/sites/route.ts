import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/sites — obyektlar + statistika + moliya (avans/xarajat)
export async function GET() {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const sites = await db.site.findMany({ orderBy: { createdAt: 'desc' } })

    const attendances = await db.attendance.findMany({
      where: { status: 'PRESENT' },
      select: { siteId: true, dayRate: true, worker: { select: { dailyRate: true } } },
    })

    const costMap: Record<string, number> = {}
    const daysMap: Record<string, number> = {}
    for (const a of attendances) {
      costMap[a.siteId] = (costMap[a.siteId] ?? 0) + (a.dayRate ?? a.worker.dailyRate ?? 0)
      daysMap[a.siteId] = (daysMap[a.siteId] ?? 0) + 1
    }

    // Moliya: avans (kirim) va xarajatlar
    const txs = await db.siteTransaction.groupBy({
      by: ['siteId', 'type'],
      _sum: { amount: true },
    })
    const advMap: Record<string, number> = {}
    const expMap: Record<string, number> = {}
    for (const t of txs) {
      if (t.type === 'ADVANCE') advMap[t.siteId] = t._sum.amount ?? 0
      else expMap[t.siteId] = t._sum.amount ?? 0
    }

    const result = sites.map((s) => ({
      ...s,
      workerDays: daysMap[s.id] ?? 0,
      totalCost: costMap[s.id] ?? 0,
      totalAdvance: advMap[s.id] ?? 0,
      totalExpense: expMap[s.id] ?? 0,
      balance: (advMap[s.id] ?? 0) - (expMap[s.id] ?? 0) - (costMap[s.id] ?? 0),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/sites error:', error)
    return NextResponse.json({ error: 'Obyektlarni olishda xatolik' }, { status: 500 })
  }
}

// POST /api/sites — yangi obyekt
export async function POST(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const body = await request.json()
    const name = (body.name ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Obyekt nomi majburiy' }, { status: 400 })
    }
    // Idempotent yaratish — aynan shu so'rov saqlangan bo'lsa mavjudini qaytaramiz
    const clientKey = typeof body.clientKey === 'string' ? body.clientKey.trim().slice(0, 64) : ''
    if (clientKey) {
      const existing = await db.site.findUnique({ where: { clientKey } })
      if (existing) return NextResponse.json(existing)
    }
    const site = await db.site.create({
      data: {
        name,
        address: (body.address ?? '').trim() || null,
        client: (body.client ?? '').trim() || null,
        active: body.active !== false,
        clientKey: clientKey || null,
      },
    })
    return NextResponse.json(site, { status: 201 })
  } catch (error) {
    console.error('POST /api/sites error:', error)
    return NextResponse.json({ error: "Obyekt qo'shishda xatolik" }, { status: 500 })
  }
}
