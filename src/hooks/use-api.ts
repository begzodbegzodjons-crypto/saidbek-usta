'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------- Token (cookie bloklangan muhitlar uchun ham) ----------------
// 3 qatlamli saqlash: xotira -> localStorage -> sessionStorage.
// iOS maxfiy rejimda yoki ayrim brauzerlarda localStorage yozish xato berishi mumkin —
// shunda ham token xotirada saqlanib, sessiya ishlashda davom etadi.

const TOKEN_KEY = 'qp_token'
let memoryToken: string | null = null

function safeGet(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(TOKEN_KEY) ?? null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken
  if (typeof window === 'undefined') return null
  const t = safeGet(window.localStorage) ?? safeGet(window.sessionStorage)
  memoryToken = t
  return t
}

function safeSet(storage: Storage | undefined, value: string) {
  try {
    storage?.setItem(TOKEN_KEY, value)
  } catch {
    // Saqlash bloklangan — xotiradagi nusxa ishlaydi
  }
}

function safeRemove(storage: Storage | undefined) {
  try {
    storage?.removeItem(TOKEN_KEY)
  } catch {
    // bo'ldi
  }
}

export function setToken(token: string): void {
  memoryToken = token
  if (typeof window === 'undefined') return
  safeSet(window.localStorage, token)
  safeSet(window.sessionStorage, token)
}

export function clearToken(): void {
  memoryToken = null
  if (typeof window === 'undefined') return
  safeRemove(window.localStorage)
  safeRemove(window.sessionStorage)
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Sessiya tugaganda login ekranga qaytish uchun global hodisa
export function onUnauthorized() {
  clearToken()
  window.dispatchEvent(new CustomEvent('qp-unauthorized'))
}

// ---------------- Tarmoq holati ----------------

// Internet aloqasi holatini kuzatish (offline banner uchun)
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    // Boshlang'ich holatni aniqlash (brauzer sahifani offline holatda ochgan bo'lishi mumkin)
    const t = setTimeout(() => setOnline(navigator.onLine), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

// ---------------- Fetch yordamchilari ----------------

const TIMEOUT_MS = 20_000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

// fetch tarmoq darajasida muvaffaqiyatsiz bo'ldi (so'rov serverga yetib bormagan)
function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

function friendlyError(e: unknown): Error {
  if (isAbort(e))
    return new Error("Server javob bermadi (taymaut). Internetni tekshirib, qaytadan bosing — kiritgan ma'lumotingiz yo'qolmaydi.")
  if (isNetworkError(e))
    return new Error("Internet aloqasi uzildi. Internetni tekshirib, qaytadan bosing — kiritgan ma'lumotingiz yo'qolmaydi.")
  if (e instanceof Error) return e
  return new Error('Xatolik yuz berdi')
}

// GET so'rovlar uchun sodda hook — taymaut, 2 martalik qayta urinish va
// internet tiklanganda avtomatik yangilanish bilan
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    if (!url) {
      setLoading(false)
      return
    }
    const mySeq = ++seq.current
    setError(null)
    setLoading(true)
    let lastError: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetchJson(url, { headers: authHeaders() }, TIMEOUT_MS)
        const json = await res.json().catch(() => ({}))
        if (res.status === 401) {
          onUnauthorized()
          throw new Error('Sessiya tugagan')
        }
        if (!res.ok) {
          throw new Error((json as { error?: string }).error || `Xatolik: ${res.status}`)
        }
        if (mySeq !== seq.current) return // yangi so'rov boshlangan — eskirgan natija
        setData(json as T)
        setError(null)
        setLoading(false)
        return
      } catch (e) {
        if (e instanceof Error && e.message === 'Sessiya tugagan') {
          if (mySeq !== seq.current) return
          setError(e.message)
          setLoading(false)
          return
        }
        lastError = e
        if (attempt < 2) await sleep(700 * (attempt + 1)) // 0.7s, 1.4s kutib qayta urinish
      }
    }
    if (mySeq !== seq.current) return
    setError(friendlyError(lastError).message)
    setLoading(false)
  }, [url])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Internet tiklanganda barcha ma'lumotlarni avtomatik yangilash
  useEffect(() => {
    if (!url) return
    const onOnline = () => void refresh()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh, url])

  return { data, loading, error, refresh }
}

// POST / PATCH / DELETE so'rovlari — taymaut + aqlli qayta urinish + keepalive bilan.
// keepalive: telefon brauzerida sahifa yopilsa/yashirinsa ham so'rov serverga yetib boradi.
// POST faqat so'rov serverga YETIB BORMAGAN holda qayta uriniladi (ikki marta yozilmasligi uchun).
export async function apiSend<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    keepalive: true,
  }

  const maxAttempts = 3
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchJson(url, init, TIMEOUT_MS)
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) {
        onUnauthorized()
        throw new Error('Sessiya tugagan — qaytadan kiring')
      }
      if (!res.ok) {
        const err = new Error((json as { error?: string }).error || `Xatolik: ${res.status}`)
        // Server vaqtinchalik xatosi (5xx) — ozgina kutib qayta urinish mantiqiy
        if (res.status >= 500 && attempt < maxAttempts - 1) {
          lastError = err
          await sleep(800 * (attempt + 1))
          continue
        }
        throw err
      }
      return json as T
    } catch (e) {
      if (e instanceof Error && e.message.includes('Sessiya tugagan')) throw e
      lastError = e
      // POST: faqat tarmoq darajasidagi xatoda (so'rov yetib bormagan) qayta uriniladi
      const retriable = isNetworkError(e) || method !== 'POST'
      if (retriable && attempt < maxAttempts - 1) {
        await sleep(800 * (attempt + 1))
        continue
      }
      break
    }
  }
  throw friendlyError(lastError)
}

// Har bir yangi yozuv uchun o'ziga xos kalit — serverda ikki marta yozilishning oldini oladi
// (aynan shu ma'lumot allaqachon saqlangan bo'lsa, server mavjud yozuvni qaytaradi)
export function newClientKey(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    // bo'ldi
  }
  return `k${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

// Firma nomi (hisobotlar PDF sarlavhasi uchun)
export function useCompany(): string {
  const { data } = useApi<{ companyName: string }>('/api/settings')
  return data?.companyName || 'Qurilish firmam'
}
