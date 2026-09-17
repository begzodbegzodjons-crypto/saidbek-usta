import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoBackupIfNeeded, getLastBackup } from '@/lib/backup'
import { requireAuth } from '@/lib/auth'

// GET /api/settings — sozlamalar + oxirgi zaxira ma'lumoti
export async function GET() {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    // Kunlik avtomatik zaxira (agar 20+ soat o'tgan bo'lsa)
    autoBackupIfNeeded().catch(() => {})

    const rows = await db.setting.findMany()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value

    const lastBackup = await getLastBackup()

    return NextResponse.json({
      companyName: map.companyName || 'Qurilish firmam',
      lastBackup,
    })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: 'Sozlamalarni olishda xatolik' }, { status: 500 })
  }
}

// PUT /api/settings — sozlamalarni saqlash
export async function PUT(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const body = await request.json()
    if (body.companyName !== undefined) {
      const companyName = String(body.companyName).trim().slice(0, 120)
      await db.setting.upsert({
        where: { key: 'companyName' },
        create: { key: 'companyName', value: companyName },
        update: { value: companyName },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json({ error: 'Saqlashda xatolik' }, { status: 500 })
  }
}
