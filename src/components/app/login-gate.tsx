'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { HardHat, Eye, EyeOff, Lock, AlertCircle, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setToken } from '@/hooks/use-api'

// Kirish oynasi — parol bilan himoyalangan tizimga yo'l
export default function LoginGate({
  onSuccess,
  isDefaultPassword,
}: {
  onSuccess: () => void
  isDefaultPassword: boolean
}) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string }).error || "Parol noto'g'ri")
        setBusy(false)
        return
      }
      // Tokenni saqlaymiz — cookie bloklangan muhitlarda ham sessiya ishlaydi
      if (typeof (json as { token?: string }).token === 'string') {
        setToken((json as { token: string }).token)
      }
      onSuccess()
    } catch {
      setError('Ulanishda xatolik — internetni tekshiring')
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Yumshoq fon bezaklari */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/60 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-2xl border bg-card p-7 shadow-xl shadow-black/5 sm:p-8">
          {/* Brend */}
          <div className="mb-7 flex flex-col items-center text-center">
            <span className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
              <HardHat className="h-8 w-8" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">QurilPro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Qurilish firmasi boshqaruv tizimi
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Maxfiy parol</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  placeholder="Parolni kiriting"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  autoFocus
                  className="h-11 pl-9 pr-10 text-base"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={show ? 'Parolni yashirish' : 'Parolni ko\u2018rsatish'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <Button type="submit" className="h-11 w-full text-base" disabled={busy || !password.trim()}>
              {busy ? 'Tekshirilmoqda...' : 'Tizimga kirish'}
            </Button>
          </form>

          {isDefaultPassword && (
            <p className="mt-4 rounded-lg bg-secondary/70 px-3 py-2 text-center text-xs text-secondary-foreground">
              Standart parol: <b>qurilpro</b> — Sozlamalarda o&apos;zingizga qulay parolga almashtiring
            </p>
          )}
        </div>

        {/* Imtiyozlar */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <ShieldCheck className="mx-auto h-4 w-4" />, label: 'Zaxiralangan' },
            { icon: <TrendingUp className="mx-auto h-4 w-4" />, label: 'Avtomatik hisob' },
            { icon: <Wallet className="mx-auto h-4 w-4" />, label: "To'liq moliya" },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border bg-card/60 px-2 py-2.5 text-[11px] font-medium text-muted-foreground">
              <span className="mb-1 flex justify-center text-primary">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
