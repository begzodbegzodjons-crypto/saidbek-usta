import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/payments?workerId=&from=&to=
export async function GET(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get('workerId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = {}
    if (workerId) where.workerId = workerId
    if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, string>).gte = from
      if (to) (where.date as Record<string, string>).lte = to
    }

    const payments = await db.payment.findMany({
      where,
      include: { worker: { select: { id: true, fullName: true, position: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('GET /api/payments error:', error)
    return NextResponse.json({ error: "To'lovlarni olishda xatolik" }, { status: 500 })
  }
}

// POST /api/payments — yangi to'lov
export async function POST(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied
  try {
    const body = await request.json()
    const workerId = String(body.workerId ?? '').trim()
    const amount = Number(body.amount)
    const date = String(body.date ?? '').trim()

    if (!workerId) {
      return NextResponse.json({ error: 'Ishchi tanlanmagan' }, { status: 400 })
    }
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "To'lov summasi noto'g'ri" }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Sana noto'g'ri formatda" }, { status: 400 })
    }
    const worker = await db.worker.findUnique({ where: { id: workerId } })
    if (!worker) {
      return NextResponse.json({ error: 'Ishchi topilmadi' }, { status: 404 })
    }

    // Idempotent yaratish — aynan shu so'rov saqlangan bo'lsa (qayta urinish),
    // pul IKKI MARTA yozilmaydi: mavjud to'lov qaytariladi
    const clientKey = typeof body.clientKey === 'string' ? body.clientKey.trim().slice(0, 64) : ''
    if (clientKey) {
      const existing = await db.payment.findUnique({
        where: { clientKey },
        include: { worker: { select: { id: true, fullName: true, position: true } } },
      })
      if (existing) return NextResponse.json(existing)
    }

    const payment = await db.payment.create({
      data: {
        workerId,
        amount,
        date,
        note: (body.note ?? '').trim() || null,
        clientKey: clientKey || null,
      },
      include: { worker: { select: { id: true, fullName: true, position: true } } },
    })
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('POST /api/payments error:', error)
    return NextResponse.json({ error: "To'lov qo'shishda xatolik" }, { status: 500 })
  }
}
