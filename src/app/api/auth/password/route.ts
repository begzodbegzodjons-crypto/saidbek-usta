import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, verifyPassword, getSetting, setSetting, hashPassword } from '@/lib/auth'

// POST /api/auth/password — parolni o'zgartirish (tizimga kirgan bo'lish kerak)
export async function POST(request: NextRequest) {
  const denied = await requireAuth()
  if (denied) return denied

  try {
    const body = await request.json().catch(() => ({}))
    const currentPassword = String(body?.currentPassword ?? '')
    const newPassword = String(body?.newPassword ?? '')

    const stored = await getSetting('password_hash')
    if (!stored || !verifyPassword(currentPassword, stored)) {
      return NextResponse.json({ error: "Hozirgi parol noto'g'ri" }, { status: 400 })
    }
    if (newPassword.trim().length < 4) {
      return NextResponse.json({ error: "Yangi parol kamida 4 belgidan iborat bo'lsin" }, { status: 400 })
    }

    await setSetting('password_hash', hashPassword(newPassword.trim()))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/auth/password error:', error)
    return NextResponse.json({ error: "Parolni o'zgartirishda xatolik" }, { status: 500 })
  }
}
