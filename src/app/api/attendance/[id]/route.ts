import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// DELETE /api/attendance/[id] — davomat yozuvini o'chirish
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    await db.attendance.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Allaqachon o'chirilgan bo'lsa — muvaffaqiyatli hisoblaymiz (qayta urinish xavfsiz)
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ ok: true })
    console.error('DELETE /api/attendance/[id] error:', error)
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 })
  }
}

// PATCH /api/attendance/[id] — bitta yozuvni tahrirlash (status / kunlik haq / obyekt)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json()
    const existing = await db.attendance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Yozuv topilmadi' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.status !== undefined && (body.status === 'PRESENT' || body.status === 'ABSENT')) {
      data.status = body.status
    }
    if (body.siteId !== undefined && String(body.siteId).trim()) {
      data.siteId = String(body.siteId).trim()
    }
    if (body.dayRate !== undefined) {
      if (body.dayRate === null || body.dayRate === '') {
        data.dayRate = null
      } else {
        const r = Number(body.dayRate)
        if (!isNaN(r) && r >= 0) data.dayRate = r
      }
    }
    if (body.note !== undefined) data.note = String(body.note).trim() || null

    const record = await db.attendance.update({ where: { id }, data })
    return NextResponse.json(record)
  } catch (error) {
    console.error('PATCH /api/attendance/[id] error:', error)
    return NextResponse.json({ error: 'Tahrirlashda xatolik' }, { status: 500 })
  }
}
