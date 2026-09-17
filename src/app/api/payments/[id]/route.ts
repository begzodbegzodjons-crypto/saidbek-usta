import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// DELETE /api/payments/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    await db.payment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Allaqachon o'chirilgan bo'lsa — muvaffaqiyatli hisoblaymiz (qayta urinish xavfsiz)
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ ok: true })
    console.error('DELETE /api/payments/[id] error:', error)
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 })
  }
}
