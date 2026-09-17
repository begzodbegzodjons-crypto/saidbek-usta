import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'qp_session'
const SESSION_DAYS = 30
export const DEFAULT_PASSWORD = 'qurilpro'

// ---------------- Setting yordamchilari ----------------

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

// ---------------- Parol (scrypt bilan xeshlanadi) ----------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, salt, hash] = stored.split('$')
    if (algo !== 'scrypt' || !salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

// Birinchi kirish uchun standart parolni avtomatik yaratish
export async function ensurePasswordInitialized(): Promise<void> {
  const existing = await getSetting('password_hash')
  if (!existing) {
    await setSetting('password_hash', hashPassword(DEFAULT_PASSWORD))
  }
}

export async function isDefaultPassword(): Promise<boolean> {
  const stored = await getSetting('password_hash')
  if (!stored) return true
  return verifyPassword(DEFAULT_PASSWORD, stored)
}

// ---------------- Sessiya tokeni (HMAC imzolangan muddat) ----------------

async function getSessionSecret(): Promise<string> {
  let secret = await getSetting('session_secret')
  if (!secret) {
    secret = randomBytes(32).toString('hex')
    await setSetting('session_secret', secret)
  }
  return secret
}

async function createSessionToken(): Promise<string> {
  const secret = await getSessionSecret()
  const exp = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const sig = createHmac('sha256', secret).update(exp).digest('hex')
  return `${exp}.${sig}`
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !token.includes('.')) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig) return false
  if (Number(exp) < Date.now()) return false
  const secret = await getSessionSecret()
  const expected = createHmac('sha256', secret).update(exp).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// ---------------- API himoyasi ----------------

export async function isAuthed(): Promise<boolean> {
  // 1-usul: Authorization: Bearer <token> (cookie bloklangan muhitlarda — preview iframe va h.k.)
  try {
    const h = await headers()
    const auth = h.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7).trim()
      if (token && (await verifySessionToken(token))) return true
    }
  } catch {
    // headers o'qib bo'lmasa — cookie bilan davom etamiz
  }
  // 2-usul: httpOnly cookie
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

// Har bir himoyalangan API route boshida chaqiriladi:
//   const denied = await requireAuth(); if (denied) return denied
export async function requireAuth(): Promise<NextResponse | null> {
  if (await isAuthed()) return null
  return NextResponse.json(
    { error: 'Sessiya tugagan — qaytadan parol bilan kiring' },
    { status: 401 }
  )
}

// ---------------- Login / Logout javoblari ----------------

export async function loginResponse(request?: NextRequest): Promise<NextResponse> {
  const token = await createSessionToken()
  // HTTPS orqali kirilganda SameSite=None — ichma-ich oynalar (preview iframe) ham cookie saqlaydi.
  // Lokal HTTP'da lax ishlatiladi (None secure talab qiladi).
  const proto =
    request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    request?.nextUrl.protocol.replace(':', '') ||
    'http'
  const isHttps = proto === 'https'
  const res = NextResponse.json({ ok: true, token })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
  return res
}

export async function logoutResponse(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}

// ---------------- Noto'g'ri parol urinishlarini cheklash ----------------

const attempts = new Map<string, number[]>()
const MAX_ATTEMPTS = 15
const WINDOW_MS = 10 * 60 * 1000

export function tooManyAttempts(ip: string): boolean {
  const now = Date.now()
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  attempts.set(ip, list)
  return list.length >= MAX_ATTEMPTS
}

export function registerFailedAttempt(ip: string): void {
  const now = Date.now()
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  list.push(now)
  attempts.set(ip, list)
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip)
}
