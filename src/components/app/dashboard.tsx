'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { HardHat, Users, ClipboardCheck, Wallet, TrendingUp, AlertCircle, Building2, CalendarDays, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi, useCompany } from '@/hooks/use-api'
import { formatMoney, formatDateUz, todayStr } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import type { TabKey } from './nav'

export default function Dashboard({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const companyName = useCompany()
  const { data, loading, error } = useApi<DashboardData>('/api/dashboard')

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error || 'Ma\u2019lumot yuklanmadi'}</p>
          <Button variant="outline" size="sm" onClick={() => location.reload()}>Qayta yuklash</Button>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.trend.map((t) => ({
    name: t.date.slice(8, 10) + '.' + t.date.slice(5, 7),
    Ishchilar: t.count,
  }))

  const maxSiteCost = Math.max(1, ...data.bySite.map((s) => s.cost))

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary/80">{companyName}</p>
          <h1 className="text-xl font-bold lg:text-2xl">Boshqaruv paneli</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {formatDateUz(todayStr())}
          </p>
        </div>
        <Button onClick={() => onNavigate('attendance')} className="gap-2">
          <ClipboardCheck className="h-4 w-4" /> Bugungi davomat
        </Button>
      </div>

      {/* Statistikalar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          title="Faol ishchilar"
          value={String(data.workersActive)}
          icon={<Users className="h-5 w-5" />}
          onClick={() => onNavigate('workers')}
        />
        <StatCard
          title="Bugun keldi"
          value={`${data.todayStats.present} / ${data.todayStats.present + data.todayStats.absent}`}
          hint={data.todayStats.absent > 0 ? `${data.todayStats.absent} kelmadi` : 'Kelganlar soni / belgilanganlar'}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="green"
          onClick={() => onNavigate('attendance')}
        />
        <StatCard
          title="Bu oy ish haqi"
          value={formatMoney(data.monthStats.earned)}
          hint={`${data.monthStats.days} kun ishlangan`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="amber"
          onClick={() => onNavigate('payments')}
        />
        <StatCard
          title="Bu oy avanslar"
          value={`+${formatMoney(data.monthFinance.advance)}`}
          hint="Obyektlarga kelgan pul"
          icon={<ArrowDownCircle className="h-5 w-5" />}
          tone="green"
          onClick={() => onNavigate('finance')}
        />
        <StatCard
          title="Bu oy xarajatlar"
          value={`-${formatMoney(data.monthFinance.expense)}`}
          hint="Material va boshqa sarf"
          icon={<ArrowUpCircle className="h-5 w-5" />}
          tone="red"
          onClick={() => onNavigate('finance')}
        />
        <StatCard
          title="Umumiy qarz"
          value={formatMoney(data.totalDebt)}
          hint="To'lanmagan ish haqi"
          icon={<Wallet className="h-5 w-5" />}
          tone={data.totalDebt > 0 ? 'red' : 'green'}
          onClick={() => onNavigate('payments')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend grafik */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Oxirgi 7 kun davomati</CardTitle>
          </CardHeader>
          <CardContent className="h-56 lg:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e6e0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#a8a69e" />
                <YAxis tick={{ fontSize: 11 }} stroke="#a8a69e" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e4e2da', fontSize: 12 }}
                  formatter={(v) => [`${v} kishi`, 'Keldi']}
                />
                <Bar dataKey="Ishchilar" fill="#3d8a96" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Oylik xarajat obyektlar bo'yicha */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" /> Oy xarajati — obyektlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.bySite.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu oyda xarajat yo&apos;q</p>
            )}
            {data.bySite.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney(s.cost)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(6, (s.cost / maxSiteCost) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bugungi davomat ro'yxati */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Bugungi davomat</span>
              <Badge variant="secondary">{data.todayStats.present + data.todayStats.absent} kishi</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {data.todayStats.records.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <HardHat className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Bugunga davomat belgilanmagan</p>
                <Button size="sm" variant="outline" onClick={() => onNavigate('attendance')}>Belgilash</Button>
              </div>
            )}
            {data.todayStats.records.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.worker.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.site.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                    {r.status === 'PRESENT' ? formatMoney(r.dayRate ?? r.worker.dailyRate) : '—'}
                  </span>
                  {r.status === 'PRESENT' ? (
                    <Badge className="bg-emerald-100/80 text-emerald-800 hover:bg-emerald-100/80">Keldi</Badge>
                  ) : (
                    <Badge className="bg-rose-100/80 text-rose-700 hover:bg-rose-100/80">Kelmadi</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Eng katta qarzdorliklar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" /> To&apos;lov kutilmoqda
              </span>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('payments')}>
                To&apos;lovlar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {data.topDebtors.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Qarzdorlik yo&apos;q — hammasi to&apos;langan</p>
            )}
            {data.topDebtors.map((w, i) => (
              <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{w.fullName}</p>
                    {w.position && <p className="truncate text-xs text-muted-foreground">{w.position}</p>}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700">
                  +{formatMoney(w.balance)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  hint,
  icon,
  tone = 'default',
  onClick,
}: {
  title: string
  value: string
  hint?: string
  icon: React.ReactNode
  tone?: 'default' | 'green' | 'red' | 'amber'
  onClick?: () => void
}) {
  const toneCls =
    tone === 'green'
      ? 'text-emerald-700 bg-emerald-50'
      : tone === 'red'
        ? 'text-rose-700 bg-rose-50'
        : tone === 'amber'
          ? 'text-amber-700 bg-amber-50'
          : 'text-primary bg-primary/10'
  return (
    <Card
      className={`p-4 transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : 'hover:shadow-sm'}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-sm font-bold tabular-nums sm:text-lg lg:text-xl">{value}</p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneCls}`}>{icon}</span>
      </div>
    </Card>
  )
}
