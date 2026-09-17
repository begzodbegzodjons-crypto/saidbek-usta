import { NextResponse } from 'next/server'
import { isAuthed, isDefaultPassword, logoutResponse } from '@/lib/auth'

// GET /api/auth/session — foydalanuvchi kirmi-yo'qmi
export async function GET() {
  try {
    const authed = await isAuthed()
    return NextResponse.json({
      authed,
      isDefaultPassword: authed ? await isDefaultPassword() : false,
    })
  } catch (error) {
    console.error('GET /api/auth/session error:', error)
    return NextResponse.json({ authed: false, isDefaultPassword: false })
  }
}

// DELETE /api/auth/session — tizimdan chiqish
export async function DELETE() {
  return logoutResponse()
}
