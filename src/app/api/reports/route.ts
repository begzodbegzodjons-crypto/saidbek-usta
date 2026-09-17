import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/reports?from=&to=&workerId=&siteId=
// Hisobot: ishchilar bo'yicha, obyektlar bo'yicha, kunlar bo'yicha
export async function GET(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')
    const siteId = searchParams.get('siteId')

    const where: Record<string, unknown> = {}
    if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, string>).gte = from
      if (to) (where.date as Record<string, string>).lte = to
    }
    if (workerId) where.workerId = workerId
    if (siteId) where.siteId = siteId

    const attendances = await db.attendance.findMany({
      where,
      include: {
        worker: { select: { id: true, fullName: true, position: true, dailyRate: true } },
        site: { select: { id: true, name: true } },
      },
    })

    const payWhere: Record<string, unknown> = {}
    if (from || to) {
      payWhere.date = {}
      if (from) (payWhere.date as Record<string, string>).gte = from
      if (to) (payWhere.date as Record<string, string>).lte = to
    }
    if (workerId) payWhere.workerId = workerId
    const payments = await db.payment.findMany({ where: payWhere })

    // Moliya: obyektlar bo'yicha avans va xarajatlar (davr bo'yicha)
    const txWhere: Record<string, unknown> = {}
    if (from || to) {
      txWhere.date = {}
      if (from) (txWhere.date as Record<string, string>).gte = from
      if (to) (txWhere.date as Record<string, string>).lte = to
    }
    if (siteId) txWhere.siteId = siteId
    const transactions = await db.siteTransaction.findMany({
      where: txWhere,
      include: { site: { select: { id: true, name: true } } },
    })
    const txMap: Record<string, { siteId: string; siteName: string; advance: number; expense: number; txCount: number }> = {}
    for (const t of transactions) {
      if (!txMap[t.siteId]) {
        txMap[t.siteId] = { siteId: t.siteId, siteName: t.site.name, advance: 0, expense: 0, txCount: 0 }
      }
      if (t.type === 'ADVANCE') txMap[t.siteId].advance += t.amount
      else txMap[t.siteId].expense += t.amount
      txMap[t.siteId].txCount += 1
    }
    const bySiteFinance = Object.values(txMap)
      .map((r) => ({ ...r, net: r.advance - r.expense }))
      .sort((a, b) => b.advance + b.expense - (a.advance + a.expense))

    // Ishchilar bo'yicha
    const wMap: Record<string, { workerId: string; worker: typeof attendances[number]['worker']; days: number; absent: number; earned: number }> = {}
    for (const a of attendances) {
      if (!wMap[a.workerId]) {
        wMap[a.workerId] = { workerId: a.workerId, worker: a.worker, days: 0, absent: 0, earned: 0 }
      }
      const amount = a.dayRate ?? a.worker.dailyRate ?? 0
      if (a.status === 'PRESENT') {
        wMap[a.workerId].days += 1
        wMap[a.workerId].earned += amount
      } else {
        wMap[a.workerId].absent += 1
      }
    }
    const pMap: Record<string, number> = {}
    for (const p of payments) {
      pMap[p.workerId] = (pMap[p.workerId] ?? 0) + p.amount
    }
    const byWorker = Object.values(wMap)
      .map((r) => ({
        workerId: r.workerId,
        workerName: r.worker.fullName,
        position: r.worker.position,
        days: r.days,
        absent: r.absent,
        earned: r.earned,
        paid: pMap[r.workerId] ?? 0,
        balance: r.earned - (pMap[r.workerId] ?? 0),
      }))
      .sort((a, b) => b.earned - a.earned)

    // Obyektlar bo'yicha
    const sMap: Record<string, { site: typeof attendances[number]['site']; days: number; cost: number; absent: number }> = {}
    for (const a of attendances) {
      if (!sMap[a.siteId]) {
        sMap[a.siteId] = { site: a.site, days: 0, cost: 0, absent: 0 }
      }
      const amount = a.dayRate ?? a.worker.dailyRate ?? 0
      if (a.status === 'PRESENT') {
        sMap[a.siteId].days += 1
        sMap[a.siteId].cost += amount
      } else {
        sMap[a.siteId].absent += 1
      }
    }
    const bySite = Object.values(sMap)
      .map((r) => ({
        siteId: r.site.id,
        siteName: r.site.name,
        workerDays: r.days,
        absent: r.absent,
        cost: r.cost,
      }))
      .sort((a, b) => b.cost - a.cost)

    // Kunlar bo'yicha
    const dMap: Record<string, { present: number; absent: number; cost: number }> = {}
    for (const a of attendances) {
      if (!dMap[a.date]) dMap[a.date] = { present: 0, absent: 0, cost: 0 }
      const amount = a.dayRate ?? a.worker.dailyRate ?? 0
      if (a.status === 'PRESENT') {
        dMap[a.date].present += 1
        dMap[a.date].cost += amount
      } else {
        dMap[a.date].absent += 1
      }
    }
    const byDate = Object.entries(dMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    // Detallar (har bir yozuv) — eksport uchun
    const details = attendances
      .map((a) => ({
        date: a.date,
        workerName: a.worker.fullName,
        position: a.worker.position,
        siteName: a.site.name,
        status: a.status,
        rate: a.dayRate ?? a.worker.dailyRate ?? 0,
        amount: a.status === 'PRESENT' ? (a.dayRate ?? a.worker.dailyRate ?? 0) : 0,
        note: a.note,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.workerName.localeCompare(b.workerName)))

    const totals = {
      days: byWorker.reduce((s, r) => s + r.days, 0),
      absent: byWorker.reduce((s, r) => s + r.absent, 0),
      earned: byWorker.reduce((s, r) => s + r.earned, 0),
      paid: byWorker.reduce((s, r) => s + r.paid, 0),
      balance: byWorker.reduce((s, r) => s + r.balance, 0),
    }

    const financeTotals = {
      advance: bySiteFinance.reduce((s, r) => s + r.advance, 0),
      expense: bySiteFinance.reduce((s, r) => s + r.expense, 0),
    }

    return NextResponse.json({
      byWorker,
      bySite,
      byDate,
      bySiteFinance,
      financeTotals,
      details,
      totals,
    })
  } catch (error) {
    console.error('GET /api/reports error:', error)
    return NextResponse.json({ error: 'Hisobotni olishda xatolik' }, { status: 500 })
  }
}
