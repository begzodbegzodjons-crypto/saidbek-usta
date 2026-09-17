import { NextResponse } from 'next/server'
import { createServerBackup, exportAllData, getLastBackup } from '@/lib/backup'
import { requireAuth } from '@/lib/auth'

// GET /api/backup — zaxira faylini yuklab berish (browser orqali saqlanadi)
export async function GET() {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const payload = await exportAllData()
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="qurilpro-zaxira-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error('GET /api/backup error:', error)
    return NextResponse.json({ error: 'Zaxira yaratishda xatolik' }, { status: 500 })
  }
}

// POST /api/backup — serverga qo'lda zaxira yozish ("Hozir zaxiralash" tugmasi)
export async function POST() {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const file = await createServerBackup('manual')
    const lastBackup = await getLastBackup()
    return NextResponse.json({ ok: true, file, lastBackup })
  } catch (error) {
    console.error('POST /api/backup error:', error)
    return NextResponse.json({ error: 'Zaxira yaratishda xatolik' }, { status: 500 })
  }
}
