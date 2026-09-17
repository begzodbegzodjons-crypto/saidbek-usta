import { NextRequest, NextResponse } from 'next/server'
import { restoreFromBackup, getLastBackup } from '@/lib/backup'
import { requireAuth } from '@/lib/auth'

// POST /api/restore — zaxira faylidan ma'lumotlarni to'liq tiklash
// body: { data: { workers, sites, attendances, payments, settings } }
export async function POST(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const body = await request.json()
    const result = await restoreFromBackup(body)
    const lastBackup = await getLastBackup()
    return NextResponse.json({ ok: true, restored: result, lastBackup })
  } catch (error) {
    console.error('POST /api/restore error:', error)
    const msg = error instanceof Error ? error.message : 'Tiklashda xatolik'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
