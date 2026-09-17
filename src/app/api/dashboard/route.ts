import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoBackupIfNeeded } from '@/lib/backup'
import { requireAuth } from '@/lib/auth'

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// GET /api/dashboard — boshqaruv paneli statistikasi
export async function GET() {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    // Kunlik avtomatik zaxira (20+ soat o'tgan bo'lsa) — foydalanuvchini kutgansiz
    autoBackupIfNeeded().catch(() => {})

    const today = todayStr()
    const monthPrefix = today.slice(0, 7) // YYYY-MM

    const [workersActive, sitesActive] = await Promise.all([
      db.worker.count({ where: { active: true } }),
      db.site.count({ where: { active: true } }),
    ])

    const [allPresent, allPayments, monthTxs] = await Promise.all([
      db.attendance.findMany({
        where: { status: 'PRESENT' },
        select: { workerId: true, siteId: true, date: true, dayRate: true, worker: { select: { dailyRate: true } } },
      }),
      db.payment.findMany({ select: { workerId: true, amount: true, date: true } }),
      db.siteTransaction.findMany({
        where: { date: { gte: `${monthPrefix}-01`, lte: `${monthPrefix}-31` } },
        select: { type: true, amount: true },
      }),
    ])
    let monthAdvance = 0
    let monthExpense = 0
    for (const t of monthTxs) {
      if (t.type === 'ADVANCE') monthAdvance += t.amount
      else monthExpense += t.amount
    }

    // Bugungi davomat
    const todayAll = await db.attendance.findMany({
      where: { date: today },
      include: {
        worker: { select: { id: true, fullName: true, position: true, dailyRate: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const todayPresent = todayAll.filter((r) => r.status === 'PRESENT')
    const todayAbsent = todayAll.filter((r) => r.status === 'ABSENT')
    const todayCost = todayPresent.reduce((s, r) => s + (r.dayRate ?? r.worker.dailyRate ?? 0), 0)

    // Oylik statistika
    let monthEarned = 0
    let monthDays = 0
    const siteCostMonth: Record<string, number> = {}
    for (const a of allPresent) {
      const amount = a.dayRate ?? a.worker.dailyRate ?? 0
      if (a.date.startsWith(monthPrefix)) {
        monthEarned += amount
        monthDays += 1
        siteCostMonth[a.siteId] = (siteCostMonth[a.siteId] ?? 0) + amount
      }
    }

    let monthPaid = 0
    const workerEarned: Record<string, number> = {}
    const workerPaid: Record<string, number> = {}
    for (const a of allPresent) {
      const amount = a.dayRate ?? a.worker.dailyRate ?? 0
      workerEarned[a.workerId] = (workerEarned[a.workerId] ?? 0) + amount
    }
    for (const p of allPayments) {
      workerPaid[p.workerId] = (workerPaid[p.workerId] ?? 0) + p.amount
      if (p.date.startsWith(monthPrefix)) monthPaid += p.amount
    }
    let totalDebt = 0
    for (const wid of Object.keys(workerEarned)) {
      totalDebt += workerEarned[wid] - (workerPaid[wid] ?? 0)
    }

    // Oxirgi 7 kun trendi
    const trend: { date: string; count: number; cost: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayRecords = allPresent.filter((a) => a.date === ds)
      trend.push({
        date: ds,
        count: dayRecords.length,
        cost: dayRecords.reduce((s, a) => s + (a.dayRate ?? a.worker.dailyRate ?? 0), 0),
      })
    }

    // Obyektlar bo'yicha oylik xarajat (faqat active sitelar)
    const sites = await db.site.findMany({ where: { active: true }, select: { id: true, name: true } })
    const bySite = sites
      .map((s) => ({ name: s.name, cost: siteCostMonth[s.id] ?? 0 }))
      .filter((s) => s.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6)

    // Eng katta qarzdorliklar (top 5)
    const topDebtors = await db.worker.findMany({
      where: { active: true },
      select: { id: true, fullName: true, position: true },
    })
    const debtList = topDebtors
      .map((w) => ({
        id: w.id,
        fullName: w.fullName,
        position: w.position,
        balance: (workerEarned[w.id] ?? 0) - (workerPaid[w.id] ?? 0),
      }))
      .filter((w) => w.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)

    return NextResponse.json({
      workersActive,
      sitesActive,
      todayStats: {
        present: todayPresent.length,
        absent: todayAbsent.length,
        cost: todayCost,
        records: todayAll.slice(0, 50),
      },
      monthStats: { earned: monthEarned, paid: monthPaid, days: monthDays, debt: monthEarned - monthPaid },
      monthFinance: { advance: monthAdvance, expense: monthExpense },
      totalDebt,
      trend,
      bySite,
      topDebtors: debtList,
    })
  } catch (error) {
    console.error('GET /api/dashboard error:', error)
    return NextResponse.json({ error: 'Statistikani olishda xatolik' }, { status: 500 })
  }
}
