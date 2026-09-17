import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// PATCH /api/transactions/[id] — avans/xarajatni tahrirlash
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json()
    const existing = await db.siteTransaction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Yozuv topilmadi' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.type === 'ADVANCE' || body.type === 'EXPENSE') data.type = body.type
    if (body.amount !== undefined) {
      const a = Number(body.amount)
      if (isNaN(a) || a <= 0) {
        return NextResponse.json({ error: "Summa 0 dan katta bo'lishi kerak" }, { status: 400 })
      }
      data.amount = a
    }
    if (body.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
      data.date = String(body.date)
    }
    if (body.siteId !== undefined && String(body.siteId).trim()) data.siteId = String(body.siteId).trim()
    if (body.category !== undefined) data.category = String(body.category).trim() || null
    if (body.note !== undefined) data.note = String(body.note).trim() || null

    const updated = await db.siteTransaction.update({
      where: { id },
      data,
      include: { site: { select: { id: true, name: true } } },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/transactions/[id] error:', error)
    return NextResponse.json({ error: 'Tahrirlashda xatolik' }, { status: 500 })
  }
}

// DELETE /api/transactions/[id] — o'chirish
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    await db.siteTransaction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Allaqachon o'chirilgan bo'lsa — muvaffaqiyatli hisoblaymiz (qayta urinish xavfsiz)
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ ok: true })
    console.error('DELETE /api/transactions/[id] error:', error)
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 })
  }
}
