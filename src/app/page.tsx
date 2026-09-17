'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ClipboardCheck, Users, Building2, Wallet, FileBarChart, HardHat, Settings,
  Banknote, LogOut, ShieldCheck, WifiOff,
} from 'lucide-react'
import { NAV_ITEMS, NAV_GROUPS, BOTTOM_NAV_KEYS, type TabKey } from '@/components/app/nav'
import { authHeaders, clearToken, useOnline } from '@/hooks/use-api'
import Dashboard from '@/components/app/dashboard'
import Attendance from '@/components/app/attendance'
import Workers from '@/components/app/workers'
import Sites from '@/components/app/sites'
import Payments from '@/components/app/payments'
import Finance from '@/components/app/finance'
import Reports from '@/components/app/reports'
import SettingsPage from '@/components/app/settings'
import LoginGate from '@/components/app/login-gate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const ICONS: Record<TabKey, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-[18px] w-[18px]" />,
  attendance: <ClipboardCheck className="h-[18px] w-[18px]" />,
  workers: <Users className="h-[18px] w-[18px]" />,
  sites: <Building2 className="h-[18px] w-[18px]" />,
  payments: <Wallet className="h-[18px] w-[18px]" />,
  finance: <Banknote className="h-[18px] w-[18px]" />,
  reports: <FileBarChart className="h-[18px] w-[18px]" />,
  settings: <Settings className="h-[18px] w-[18px]" />,
}

export default function Home() {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'authed'>('checking')
  const [isDefaultPassword, setIsDefaultPassword] = useState(false)
  const activeLabel = NAV_ITEMS.find((n) => n.key === tab)?.label ?? ''
  const bottomItems = NAV_ITEMS.filter((n) => BOTTOM_NAV_KEYS.includes(n.key))
  const online = useOnline()

  // Sessiyani tekshirish (cookie yoki token bilan)
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { headers: authHeaders(), cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (json?.authed) {
        setIsDefaultPassword(Boolean(json.isDefaultPassword))
        setAuthState('authed')
      } else {
        clearToken()
        setAuthState('guest')
      }
    } catch {
      setAuthState('guest')
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void checkSession()
    }, 0)
    return () => clearTimeout(t)
  }, [checkSession])

  // API 401 qaytarsa — login oynasiga qaytish
  useEffect(() => {
    if (authState !== 'authed') return
    const handler = () => setAuthState('guest')
    window.addEventListener('qp-unauthorized', handler)
    return () => window.removeEventListener('qp-unauthorized', handler)
  }, [authState])

  async function handleLogout() {
    try {
      await fetch('/api/auth/session', { method: 'DELETE', headers: authHeaders() })
    } catch {
      // bo'ldi — baribir login oynasiga o'tamiz
    }
    clearToken()
    setAuthState('guest')
  }

  // Internet uzilganda darhol ko'rinadigan ogohlantirish — foydalanuvchi "saqlanmadi" deb bilmasin,
  // balki sababini tushunsin (kiritilgan qoralamalar brauzerda saqlanib qoladi)
  const OfflineBanner = (
    <div className="flex items-center justify-center gap-2 bg-destructive/10 px-4 py-1.5 text-center text-xs font-medium text-destructive">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Internet aloqasi yo&apos;q — internet tiklanganda ma&apos;lumotlar avtomatik yangilanadi
    </div>
  )

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <HardHat className="h-7 w-7" />
          </span>
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    )
  }

  if (authState === 'guest') {
    return (
      <LoginGate
        isDefaultPassword={isDefaultPassword}
        onSuccess={() => {
          checkSession()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop yon panel — barcha funksiyalar bilan */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex items-center gap-3 border-b px-5 py-[18px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-md shadow-primary/20">
            <HardHat className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[17px] font-bold leading-tight tracking-tight">QurilPro</p>
            <p className="text-[11px] text-muted-foreground">Boshqaruv tizimi</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((n) => n.group === group)
            if (!items.length) return null
            return (
              <div key={group}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setTab(item.key)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        tab === item.key
                          ? 'bg-primary/10 font-semibold text-primary shadow-[inset_2px_0_0_0] shadow-primary'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'transition-colors',
                          tab === item.key ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-foreground'
                        )}
                      >
                        {ICONS[item.key]}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Foydalanuvchi + chiqish */}
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">Rahbar</p>
              <p className="text-[11px] text-muted-foreground">Parol bilan himoyalangan</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
              aria-label="Tizimdan chiqish"
              title="Tizimdan chiqish"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobil header */}
      <header className="sticky top-0 z-30 border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        {!online && (
          <div className="mb-2 -mx-4 -mt-3">{OfflineBanner}</div>
        )}
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/75 text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-tight">QurilPro</p>
            <p className="truncate text-[11px] text-muted-foreground">{activeLabel}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 shrink-0', tab === 'settings' && 'bg-secondary text-primary')}
            onClick={() => setTab('settings')}
            aria-label="Sozlamalar"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Asosiy kontent — pastda mobil menyu bilan ustma-ust tushmasligi uchun safe-area bilan */}
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8 lg:pl-64">
        {!online && <div className="hidden lg:block">{OfflineBanner}</div>}
        <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 lg:px-8 lg:py-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
              {tab === 'attendance' && <Attendance />}
              {tab === 'workers' && <Workers />}
              {tab === 'sites' && <Sites />}
              {tab === 'payments' && <Payments />}
              {tab === 'finance' && <Finance />}
              {tab === 'reports' && <Reports />}
              {tab === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-auto hidden border-t py-4 text-center text-xs text-muted-foreground lg:block">
          QurilPro · Ishchi davomati va hisob-kitob tizimi · {new Date().getFullYear()}
        </footer>
      </main>

      {/* Mobil pastki menyu */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-7">
          {bottomItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-medium transition-colors',
                tab === item.key ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'rounded-lg px-2 py-1 transition-colors',
                  tab === item.key && 'bg-primary/10'
                )}
              >
                {ICONS[item.key]}
              </span>
              {item.shortLabel}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
