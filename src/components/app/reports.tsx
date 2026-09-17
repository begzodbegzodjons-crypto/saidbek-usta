'use client'

import { useMemo, useState } from 'react'
import { FileBarChart, FileSpreadsheet, FileText, Filter, MapPin, UserSearch, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useApi, useCompany } from '@/hooks/use-api'
import { formatMoney, formatDateUz, weekdayUz, monthStartStr, todayStr } from '@/lib/format'
import { exportToExcel, exportToPDF } from '@/lib/export'
import type { ReportData, Worker, Site, Payment } from '@/lib/types'

export default function Reports() {
  const companyName = useCompany()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [workerId, setWorkerId] = useState('all')
  const [siteId, setSiteId] = useState('all')
  const [activeTab, setActiveTab] = useState('workers')
  const { toast } = useToast()

  const { data: workers } = useApi<Worker[]>('/api/workers')
  const { data: sites } = useApi<Site[]>('/api/sites')

  // Tanlangan ishchining to'lovlari (davr bo'yicha)
  const paymentsUrl = useMemo(
    () => (workerId !== 'all' ? `/api/payments?workerId=${workerId}&from=${from}&to=${to}` : null),
    [workerId, from, to]
  )
  const { data: workerPayments } = useApi<Payment[]>(paymentsUrl)

  const url = useMemo(() => {
    const params = new URLSearchParams({ from, to })
    if (workerId !== 'all') params.set('workerId', workerId)
    if (siteId !== 'all') params.set('siteId', siteId)
    return `/api/reports?${params.toString()}`
  }, [from, to, workerId, siteId])

  const { data, loading } = useApi<ReportData>(url)

  const selectedWorker = workers?.find((w) => w.id === workerId)

  // Tanlangan ishchi: qaysi obyektlarda necha kun ishlagan (details'dan hisoblanadi)
  const workerSiteRows = useMemo(() => {
    if (!data || workerId === 'all') return []
    const map: Record<string, { siteName: string; days: number; absent: number; amount: number }> = {}
    for (const d of data.details) {
      if (!map[d.siteName]) map[d.siteName] = { siteName: d.siteName, days: 0, absent: 0, amount: 0 }
      if (d.status === 'PRESENT') {
        map[d.siteName].days += 1
        map[d.siteName].amount += d.amount
      } else {
        map[d.siteName].absent += 1
      }
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount)
  }, [data, workerId])

  // Barcha ishchilar × obyektlar kesimi (eksport varag'i uchun)
  const workerSiteMatrix = useMemo(() => {
    if (!data) return []
    const map: Record<string, { worker: string; site: string; days: number; amount: number }> = {}
    for (const d of data.details) {
      if (d.status !== 'PRESENT') continue
      const key = `${d.workerName}||${d.siteName}`
      if (!map[key]) map[key] = { worker: d.workerName, site: d.siteName, days: 0, amount: 0 }
      map[key].days += 1
      map[key].amount += d.amount
    }
    return Object.values(map).sort((a, b) => a.worker.localeCompare(b.worker) || b.amount - a.amount)
  }, [data])

  const periodLabel = `${formatDateUz(from)} — ${formatDateUz(to)}`
  const hasData = data && (data.byWorker.length > 0 || data.bySite.length > 0)

  const workerName = workers?.find((w) => w.id === workerId)?.fullName
  const siteName = sites?.find((s) => s.id === siteId)?.name
  const subtitleParts = [periodLabel]
  if (workerName) subtitleParts.push(`Ishchi: ${workerName}`)
  if (siteName) subtitleParts.push(`Obyekt: ${siteName}`)

  function buildSheets() {
    if (!data) return []
    return [
      {
        name: "Ishchilar bo'yicha",
        head: ['Ishchi', 'Mutaxassislik', 'Ishlagan kun', 'Kelmagan', "Ish haqi (so'm)", "To'langan (so'm)", "Qoldiq (so'm)"],
        body: data.byWorker.map((r) => [
          r.workerName,
          r.position ?? '',
          r.days,
          r.absent,
          r.earned,
          r.paid,
          r.balance,
        ]),
      },
      {
        name: "Obyektlar bo'yicha",
        head: ['Obyekt', 'Kun-davomat', 'Kelmagan', "Xarajat (so'm)"],
        body: data.bySite.map((r) => [r.siteName, r.workerDays, r.absent, r.cost]),
      },
      {
        name: "Kunlar bo'yicha",
        head: ['Sana', 'Keldi', 'Kelmadi', "Summa (so'm)"],
        body: data.byDate.map((r) => [formatDateUz(r.date), r.present, r.absent, r.cost]),
      },
      {
        name: 'Moliya (avans-xarajat)',
        head: ['Obyekt', "Avans (so'm)", "Xarajat (so'm)", "Qoldiq (so'm)"],
        body: (data.bySiteFinance ?? []).map((r) => [r.siteName, r.advance, r.expense, r.net]),
      },
      {
        name: 'Ishchi-obyekt kesimi',
        head: ['Ishchi', 'Obyekt', 'Ishlagan kun', "Summa (so'm)"],
        body: workerSiteMatrix.map((r) => [r.worker, r.site, r.days, r.amount]),
      },
      {
        name: 'Batafsil (kunma-kun)',
        head: ['Sana', 'Hafta kuni', 'Ishchi', 'Mutaxassislik', 'Obyekt', 'Holat', "Kunlik haq (so'm)", "Summa (so'm)", 'Izoh'],
        body: data.details.map((d) => [
          formatDateUz(d.date),
          weekdayUz(d.date),
          d.workerName,
          d.position ?? '',
          d.siteName,
          d.status === 'PRESENT' ? 'Keldi' : 'Kelmadi',
          d.rate,
          d.amount,
          d.note ?? '',
        ]),
      },
    ]
  }

  function handleExportExcel() {
    if (!data || !hasData) return
    exportToExcel(buildSheets(), `hisobot_${from}_${to}`)
    toast({ title: 'Excel yuklandi', description: '6 varaq: ishchilar, obyektlar, kunlar, moliya, kesim, batafsil' })
  }

  function handleExportPDF() {
    if (!data || !hasData) return
    const t = data.totals
    exportToPDF({
      title: 'Hisobot — ish haqi hisob-kitobi',
      subtitle: subtitleParts.join(' · '),
      company: companyName,
      landscape: true,
      sheets: [
        {
          title: `Jami: ${t.days} kun ishlangan, ish haqi ${formatMoney(t.earned)} so'm, to'langan ${formatMoney(t.paid)} so'm, qoldiq ${formatMoney(t.balance)} so'm`,
          head: ['Ishchi', 'Kun', "Ish haqi", "To'langan", "Qoldiq"],
          body: data.byWorker.map((r) => [
            r.workerName + (r.position ? ` (${r.position})` : ''),
            r.days,
            formatMoney(r.earned),
            formatMoney(r.paid),
            formatMoney(r.balance),
          ]),
        },
        {
          title: "Ishchi bo'yicha obyektlar — qaysi obyektda necha kun ishlagan",
          head: ['Ishchi', 'Obyekt', 'Kun', 'Summa'],
          body: workerSiteMatrix.map((r) => [r.worker, r.site, r.days, formatMoney(r.amount)]),
        },
        {
          title: "Obyektlar bo'yicha",
          head: ['Obyekt', 'Kun-davomat', "Xarajat"],
          body: data.bySite.map((r) => [r.siteName, r.workerDays, formatMoney(r.cost)]),
        },
        {
          title: "Kunlar bo'yicha",
          head: ['Sana', 'Keldi', 'Kelmadi', "Summa"],
          body: data.byDate.map((r) => [formatDateUz(r.date), r.present, r.absent, formatMoney(r.cost)]),
        },
        {
          title: "Batafsil davomat — kim qachon qayerda ishlagan",
          head: ['Sana', 'Ishchi', 'Obyekt', 'Holat', "Summa"],
          body: data.details.map((d) => [
            `${formatDateUz(d.date)} (${weekdayUz(d.date)})`,
            d.workerName + (d.position ? ` (${d.position})` : ''),
            d.siteName,
            d.status === 'PRESENT' ? 'Keldi' : 'Kelmadi',
            d.status === 'PRESENT' ? formatMoney(d.amount) : '-',
          ]),
        },
        {
          title: "Moliya — avans va xarajatlar",
          head: ['Obyekt', 'Avans', 'Xarajat', 'Qoldiq'],
          body: (data.bySiteFinance ?? []).map((r) => [
            r.siteName,
            formatMoney(r.advance),
            formatMoney(r.expense),
            formatMoney(r.net),
          ]),
        },
      ],
      filename: `hisobot_${from}_${to}`,
    })
    toast({ title: 'PDF yuklandi', description: 'Fayl kompyuteringizga saqlandi' })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">Hisobotlar</h1>
          <p className="text-sm text-muted-foreground">Davr, ishchi va obyekt bo&apos;yicha hisob-kitob</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportExcel} disabled={!hasData}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button className="gap-2" onClick={handleExportPDF} disabled={!hasData}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Filtrlar */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> Filtr
          {(workerId !== 'all' || siteId !== 'all' || from !== monthStartStr() || to !== todayStr()) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1 text-xs"
              onClick={() => {
                setFrom(monthStartStr())
                setTo(todayStr())
                setWorkerId('all')
                setSiteId('all')
              }}
            >
              <X className="h-3.5 w-3.5" /> Tozalash
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Dan</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gacha</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ishchi</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha ishchilar</SelectItem>
                {workers?.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Obyekt</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha obyektlar</SelectItem>
                {sites?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Jami ko'rsatkichlar */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard title="Ishlangan kunlar" value={String(data.totals.days)} hint={`${data.totals.absent} kelmagan`} />
          <SummaryCard title="Jami ish haqi" value={formatMoney(data.totals.earned)} suffix="so'm" tone="amber" />
          <SummaryCard title="To'langan" value={formatMoney(data.totals.paid)} suffix="so'm" tone="green" />
          <SummaryCard
            title="Qoldiq (qarz)"
            value={formatMoney(data.totals.balance)}
            suffix="so'm"
            tone={data.totals.balance > 0 ? 'red' : 'green'}
          />
        </div>
      ) : null}

      {/* Hisobot jadvallari */}
      {loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : !data || !hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileBarChart className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Tanlangan davrda ma&apos;lumot yo&apos;q. Boshqa sana oralig&apos;ini tanlang.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="workers">Ishchilar bo&apos;yicha</TabsTrigger>
            <TabsTrigger value="worker">Ishchi bo&apos;yicha batafsil</TabsTrigger>
            <TabsTrigger value="daily">Kunma-kun (barcha ishchilar)</TabsTrigger>
            <TabsTrigger value="sites">Obyektlar bo&apos;yicha</TabsTrigger>
            <TabsTrigger value="days">Kunlar bo&apos;yicha</TabsTrigger>
            <TabsTrigger value="finance">Moliya</TabsTrigger>
          </TabsList>

          <TabsContent value="workers">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ishchi</TableHead>
                    <TableHead className="text-center">Kun</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">Kelmagan</TableHead>
                    <TableHead className="text-right">Ish haqi</TableHead>
                    <TableHead className="text-right">To&apos;langan</TableHead>
                    <TableHead className="text-right">Qoldiq</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byWorker.map((r) => (
                    <TableRow key={r.workerId}>
                      <TableCell>
                        <p className="font-medium">{r.workerName}</p>
                        {r.position && <p className="text-[11px] text-muted-foreground">{r.position}</p>}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{r.days}</TableCell>
                      <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">{r.absent}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.earned)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700">{formatMoney(r.paid)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {r.balance > 0 ? (
                          <span className="text-amber-700">+{formatMoney(r.balance)}</span>
                        ) : (
                          <span className="text-emerald-600">{formatMoney(r.balance)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-secondary/60 font-semibold">
                    <TableCell>Jami</TableCell>
                    <TableCell className="text-center tabular-nums">{data.totals.days}</TableCell>
                    <TableCell className="hidden text-center tabular-nums sm:table-cell">{data.totals.absent}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(data.totals.earned)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(data.totals.paid)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(data.totals.balance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="worker">
            {workerId === 'all' ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <UserSearch className="h-10 w-10 text-muted-foreground/30" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Bir ishchining davr davomida <b>qaysi obyektlarga borgani</b>, kunma-kun harakati va
                    to&apos;lovlari ko&apos;rinishi uchun ishchini tanlang:
                  </p>
                  <Select value={workerId} onValueChange={setWorkerId}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Ishchini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {workers?.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ) : selectedWorker ? (
              <div className="space-y-4">
                {/* Ishchi kartochkasi */}
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold">{selectedWorker.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[selectedWorker.position, selectedWorker.phone].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Kunlik stavka</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(selectedWorker.dailyRate)} so&apos;m
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-secondary/60 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Ishlagan kun</p>
                      <p className="text-sm font-bold tabular-nums">
                        {data.totals.days}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          ({data.totals.absent} kelmagan)
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Ish haqi</p>
                      <p className="text-sm font-bold tabular-nums text-amber-700">{formatMoney(data.totals.earned)}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">To&apos;langan</p>
                      <p className="text-sm font-bold tabular-nums text-emerald-700">{formatMoney(data.totals.paid)}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Qoldiq (qarz)</p>
                      <p className={`text-sm font-bold tabular-nums ${data.totals.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatMoney(data.totals.balance)}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Obyektlar bo'yicha kesim */}
                <Card>
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">Qaysi obyektlarda ishlagan</p>
                    <p className="text-[11px] text-muted-foreground">Davr: {periodLabel}</p>
                  </div>
                  {workerSiteRows.length === 0 ? (
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Bu davrda ishlangan kun yo&apos;q
                    </CardContent>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Obyekt</TableHead>
                          <TableHead className="text-center">Kun</TableHead>
                          <TableHead className="hidden text-center sm:table-cell">Kelmagan</TableHead>
                          <TableHead className="text-right">Summa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workerSiteRows.map((r) => (
                          <TableRow key={r.siteName}>
                            <TableCell className="font-medium">{r.siteName}</TableCell>
                            <TableCell className="text-center tabular-nums">{r.days}</TableCell>
                            <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">
                              {r.absent}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(r.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-secondary/60 font-semibold">
                          <TableCell>Jami</TableCell>
                          <TableCell className="text-center tabular-nums">{data.totals.days}</TableCell>
                          <TableCell className="hidden text-center tabular-nums sm:table-cell">{data.totals.absent}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(data.totals.earned)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </Card>

                {/* To'lovlar tarixi */}
                <Card className="max-h-[26rem] overflow-y-auto">
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">To&apos;lovlar tarixi</p>
                    <p className="text-[11px] text-muted-foreground">Qachon qancha pul olgani</p>
                  </div>
                  {(workerPayments ?? []).length === 0 ? (
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Bu davrda to&apos;lov yo&apos;q
                    </CardContent>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sana</TableHead>
                          <TableHead className="hidden sm:table-cell">Izoh</TableHead>
                          <TableHead className="text-right">Summa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(workerPayments ?? []).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{formatDateUz(p.date)}</TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">{p.note || '—'}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums text-emerald-700">
                              {formatMoney(p.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-secondary/60 font-semibold">
                          <TableCell colSpan={2}>Jami to&apos;langan</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(data.totals.paid)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </Card>

                {/* Kunma-kun harakat */}
                <Card className="max-h-[30rem] overflow-y-auto">
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">Kunma-kun harakat</p>
                    <p className="text-[11px] text-muted-foreground">Qaysi kunda qaysi obyektda bo&apos;lgani</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sana</TableHead>
                        <TableHead>Obyekt</TableHead>
                        <TableHead className="text-center">Holat</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.details.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap font-medium">{formatDateUz(d.date)}</TableCell>
                          <TableCell>{d.siteName}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className={d.status === 'PRESENT' ? 'bg-emerald-100/80 text-emerald-800' : 'bg-rose-100/80 text-rose-800'}
                            >
                              {d.status === 'PRESENT' ? 'Keldi' : 'Kelmadi'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.status === 'PRESENT' ? formatMoney(d.amount) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="daily">
            <Card>
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">Barcha ishchilar — kunma-kun batafsil</p>
                <p className="text-[11px] text-muted-foreground">
                  Kim, qachon, qaysi obyektda ishlagani (davr: {periodLabel})
                </p>
              </div>
              <div className="max-h-[34rem] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 z-10 bg-card">
                      <TableHead>Sana</TableHead>
                      <TableHead>Ishchi</TableHead>
                      <TableHead>Obyekt</TableHead>
                      <TableHead className="text-center">Holat</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.details.map((d, i) => (
                      <TableRow key={`${d.date}-${d.workerName}-${i}`}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateUz(d.date)}
                          <span className="block text-[11px] text-muted-foreground">{weekdayUz(d.date)}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium">{d.workerName}</span>
                          {d.position && (
                            <span className="block text-[11px] text-muted-foreground">{d.position}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {d.siteName}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={d.status === 'PRESENT' ? 'bg-emerald-100/80 text-emerald-800' : 'bg-rose-100/80 text-rose-800'}
                          >
                            {d.status === 'PRESENT' ? 'Keldi' : 'Kelmadi'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {d.status === 'PRESENT' ? formatMoney(d.amount) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="sites">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obyekt</TableHead>
                    <TableHead className="text-center">Kun-davomat</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">Kelmagan</TableHead>
                    <TableHead className="text-right">Xarajat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySite.map((r) => (
                    <TableRow key={r.siteId}>
                      <TableCell className="font-medium">{r.siteName}</TableCell>
                      <TableCell className="text-center tabular-nums">{r.workerDays}</TableCell>
                      <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">{r.absent}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatMoney(r.cost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-secondary/60 font-semibold">
                    <TableCell>Jami</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {data.bySite.reduce((s, r) => s + r.workerDays, 0)}
                    </TableCell>
                    <TableCell className="hidden text-center tabular-nums sm:table-cell">
                      {data.bySite.reduce((s, r) => s + r.absent, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(data.bySite.reduce((s, r) => s + r.cost, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="days">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead className="text-center">Keldi</TableHead>
                    <TableHead className="text-center">Kelmadi</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byDate.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium">{formatDateUz(r.date)}</TableCell>
                      <TableCell className="text-center tabular-nums">{r.present}</TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">{r.absent}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
          <TabsContent value="finance">
            <Card>
              {(data.bySiteFinance ?? []).length === 0 ? (
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Bu davrda avans yoki xarajat yozuvi yo&apos;q
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obyekt</TableHead>
                      <TableHead className="text-right">Avans (kirim)</TableHead>
                      <TableHead className="text-right">Xarajat</TableHead>
                      <TableHead className="text-right">Qoldiq</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bySiteFinance.map((r) => (
                      <TableRow key={r.siteId}>
                        <TableCell className="font-medium">{r.siteName}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-700">+{formatMoney(r.advance)}</TableCell>
                        <TableCell className="text-right tabular-nums text-rose-700">-{formatMoney(r.expense)}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${r.net < 0 ? 'text-rose-700' : ''}`}>
                          {formatMoney(r.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-secondary/60 font-semibold">
                      <TableCell>Jami</TableCell>
                      <TableCell className="text-right tabular-nums">+{formatMoney(data.financeTotals?.advance ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">-{formatMoney(data.financeTotals?.expense ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney((data.financeTotals?.advance ?? 0) - (data.financeTotals?.expense ?? 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  hint,
  suffix,
  tone = 'default',
}: {
  title: string
  value: string
  hint?: string
  suffix?: string
  tone?: 'default' | 'green' | 'red' | 'amber'
}) {
  const toneCls =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'red'
        ? 'text-rose-700'
        : tone === 'amber'
          ? 'text-amber-700'
          : ''
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums lg:text-xl ${toneCls}`}>
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </p>
      {hint && <Badge variant="secondary" className="mt-1.5">{hint}</Badge>}
    </Card>
  )
}
