import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// PATCH /api/workers/[id] — ishchini tahrirlash
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json()
    const existing = await db.worker.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ishchi topilmadi' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim()
      if (!fullName) return NextResponse.json({ error: 'Ism-familiya bo\u2018sh bo\u2018lmasligi kerak' }, { status: 400 })
      data.fullName = fullName
    }
    if (body.phone !== undefined) data.phone = String(body.phone).trim() || null
    if (body.position !== undefined) data.position = String(body.position).trim() || null
    if (body.dailyRate !== undefined) {
      const dailyRate = Number(body.dailyRate)
      if (isNaN(dailyRate) || dailyRate < 0) {
        return NextResponse.json({ error: "Kunlik haq noto'g'ri kiritilgan" }, { status: 400 })
      }
      data.dailyRate = dailyRate
    }
    if (body.active !== undefined) data.active = Boolean(body.active)

    const worker = await db.worker.update({ where: { id }, data })
    return NextResponse.json(worker)
  } catch (error) {
    console.error('PATCH /api/workers/[id] error:', error)
    return NextResponse.json({ error: 'Tahrirlashda xatolik' }, { status: 500 })
  }
}

// DELETE /api/workers/[id] — ishchini o'chirish (davomat va to'lovlar ham o'chadi)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    await db.worker.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Allaqachon o'chirilgan bo'lsa — muvaffaqiyatli hisoblaymiz (qayta urinish xavfsiz)
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ ok: true })
    console.error('DELETE /api/workers/[id] error:', error)
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 })
  }
}
