import { NextRequest, NextResponse } from 'next/server'
import {
  ensurePasswordInitialized, verifyPassword, getSetting,
  loginResponse, tooManyAttempts, registerFailedAttempt, clearAttempts,
} from '@/lib/auth'

// POST /api/auth/login — parol bilan kirish
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    if (tooManyAttempts(ip)) {
      return NextResponse.json(
        { error: "Juda ko'p noto'g'ri urinish. 10 daqiqa kutib turing." },
        { status: 429 }
      )
    }

    await ensurePasswordInitialized()
    const body = await request.json().catch(() => ({}))
    const password = String(body?.password ?? '').trim()

    const stored = await getSetting('password_hash')
    if (!stored || !password || !verifyPassword(password, stored)) {
      registerFailedAttempt(ip)
      return NextResponse.json({ error: "Parol noto'g'ri. Qaytadan urinib ko'ring." }, { status: 401 })
    }

    clearAttempts(ip)
    return await loginResponse(request)
  } catch (error) {
    console.error('POST /api/auth/login error:', error)
    return NextResponse.json({ error: 'Kirishda xatolik yuz berdi' }, { status: 500 })
  }
}
