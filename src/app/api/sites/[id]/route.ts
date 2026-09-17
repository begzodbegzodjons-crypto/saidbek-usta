import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// PATCH /api/sites/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json()
    const existing = await db.site.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Obyekt topilmadi' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: 'Nomi bo\u2018sh bo\u2018lmasligi kerak' }, { status: 400 })
      data.name = name
    }
    if (body.address !== undefined) data.address = String(body.address).trim() || null
    if (body.client !== undefined) data.client = String(body.client).trim() || null
    if (body.active !== undefined) data.active = Boolean(body.active)

    const site = await db.site.update({ where: { id }, data })
    return NextResponse.json(site)
  } catch (error) {
    console.error('PATCH /api/sites/[id] error:', error)
    return NextResponse.json({ error: 'Tahrirlashda xatolik' }, { status: 500 })
  }
}

// DELETE /api/sites/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { id } = await params
    await db.site.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Allaqachon o'chirilgan bo'lsa — muvaffaqiyatli hisoblaymiz (qayta urinish xavfsiz)
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ ok: true })
    console.error('DELETE /api/sites/[id] error:', error)
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 })
  }
}
