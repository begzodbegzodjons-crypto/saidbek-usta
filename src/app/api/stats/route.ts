import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/stats — ma'lumotlar soni (Sozlamalar sahifasi uchun)
export async function GET() {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const [workers, sites, attendances, payments, siteTransactions] = await Promise.all([
      db.worker.count(),
      db.site.count(),
      db.attendance.count(),
      db.payment.count(),
      db.siteTransaction.count(),
    ])
    return NextResponse.json({ workers, sites, attendances, payments, siteTransactions })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Statistikani olishda xatolik' }, { status: 500 })
  }
}
