'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Banknote, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, FileSpreadsheet, FileText,
  Building2, Filter, X, TrendingDown, TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useApi, useCompany, apiSend, newClientKey } from '@/hooks/use-api'
import { formatMoney, formatDateUz, monthStartStr, todayStr } from '@/lib/format'
import { exportToExcel, exportToPDF } from '@/lib/export'
import LoadError from '@/components/app/load-error'
import type { FinanceData, SiteTransaction } from '@/lib/types'

const EXPENSE_CATEGORIES = ['Material', 'Transport', 'Ish haqi (avans)', 'Ovqatlanish', 'Elektr / suv', 'Ijara', 'Boshqa']
const ADVANCE_CATEGORIES = ['Mijozdan avans', "O'z mablag'im", 'Boshqa kirim']

type TypeFilter = 'all' | 'ADVANCE' | 'EXPENSE'

const EMPTY_FORM = {
  type: 'EXPENSE' as 'ADVANCE' | 'EXPENSE',
  siteId: '',
  amount: '',
  date: todayStr(),
  category: '',
  note: '',
}

export default function Finance() {
  const companyName = useCompany()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [siteFilter, setSiteFilter] = useState('all')
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  // Har bir yangi yozuv uchun o'ziga xos kalit — qayta urinilsa ham ikki marta yozilmaydi
  const [clientKey, setClientKey] = useState('')
  const [deleting, setDeleting] = useState<SiteTransaction | null>(null)
  const { toast } = useToast()

  const url = useMemo(() => {
    const params = new URLSearchParams({ from, to })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (siteFilter !== 'all') params.set('siteId', siteFilter)
    return `/api/transactions?${params.toString()}`
  }, [from, to, typeFilter, siteFilter])

  const { data, loading, refresh, error } = useApi<FinanceData>(url)

  const hasData = data && (data.transactions.length > 0 || data.totalAdvance > 0 || data.totalExpense > 0)
  const net = (data?.totalAdvance ?? 0) - (data?.totalExpense ?? 0)
  const siteName = data?.sites.find((s) => s.id === siteFilter)?.name

  function openAdd(type: 'ADVANCE' | 'EXPENSE' = 'EXPENSE') {
    setClientKey(newClientKey())
    setForm({
      ...EMPTY_FORM,
      type,
      date: todayStr(),
      siteId: siteFilter !== 'all' ? siteFilter : data?.sites[0]?.id ?? '',
      category: type === 'ADVANCE' ? ADVANCE_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (saveLock.current) return // Ikki marta tez bosishdan himoya
    const amount = Number(form.amount)
    if (!form.siteId) {
      toast({ title: 'Xatolik', description: 'Obyektni tanlang', variant: 'destructive' })
      return
    }
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Xatolik', description: "Summani to'g'ri kiriting", variant: 'destructive' })
      return
    }
    saveLock.current = true
    setSaving(true)
    try {
      await apiSend('/api/transactions', 'POST', {
        siteId: form.siteId,
        type: form.type,
        amount,
        date: form.date,
        category: form.category,
        note: form.note,
        clientKey,
      })
      toast({
        title: form.type === 'ADVANCE' ? 'Avans qo\u2018shildi' : 'Xarajat qo\u2018shildi',
        description: `${formatMoney(amount)} so'm saqlandi`,
      })
      setDialogOpen(false)
      setClientKey('')
      refresh()
    } catch (e) {
      toast({ title: 'Saqlanmadi', description: e instanceof Error ? e.message : "Saqlashda xatolik — ma'lumotlar saqlanib qoldi, qaytadan bosing", variant: 'destructive' })
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await apiSend(`/api/transactions/${deleting.id}`, 'DELETE')
      toast({ title: "O'chirildi", description: `${formatMoney(deleting.amount)} so'm yozuvi o'chirildi` })
      refresh()
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : "O'chirishda xatolik", variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  function buildSheets() {
    if (!data) return []
    const typeLabel = (t: string) => (t === 'ADVANCE' ? 'Avans (kirim)' : 'Xarajat')
    return [
      {
        name: 'Moliya',
        head: ['Sana', 'Obyekt', 'Turi', 'Kategoriya', "Izoh", "Summa (so'm)"],
        body: data.transactions.map((t) => [
          formatDateUz(t.date),
          t.site.name,
          typeLabel(t.type),
          t.category ?? '',
          t.note ?? '',
          t.type === 'ADVANCE' ? t.amount : -t.amount,
        ]),
      },
    ]
  }

  function handleExportExcel() {
    if (!data || !hasData) return
    exportToExcel(
      [
        ...buildSheets(),
        {
          name: "Obyektlar bo'yicha",
          head: ['Obyekt', "Avans (so'm)", "Xarajat (so'm)", "Qoldiq (so'm)"],
          body: data.bySite.map((s) => [s.siteName, s.advance, s.expense, s.advance - s.expense]),
        },
      ],
      `moliya_${from}_${to}`
    )
    toast({ title: 'Excel yuklandi', description: 'Moliya hisoboti saqlandi' })
  }

  function handleExportPDF() {
    if (!data || !hasData) return
    exportToPDF({
      title: "Moliya hisoboti — avans va xarajatlar",
      subtitle: `${formatDateUz(from)} — ${formatDateUz(to)}${siteName ? ` · ${siteName}` : ''}`,
      company: companyName,
      landscape: true,
      sheets: [
        {
          title: `Jami avans: ${formatMoney(data.totalAdvance)} so'm · xarajat: ${formatMoney(data.totalExpense)} so'm · qoldiq: ${formatMoney(net)} so'm`,
          head: ['Sana', 'Obyekt', 'Turi', 'Kategoriya', 'Summa'],
          body: data.transactions.map((t) => [
            formatDateUz(t.date),
            t.site.name,
            t.type === 'ADVANCE' ? 'Avans' : 'Xarajat',
            t.category ?? '',
            (t.type === 'ADVANCE' ? '+ ' : '- ') + formatMoney(t.amount),
          ]),
        },
        {
          title: "Obyektlar bo'yicha",
          head: ['Obyekt', 'Avans', 'Xarajat', 'Qoldiq'],
          body: data.bySite.map((s) => [
            s.siteName,
            formatMoney(s.advance),
            formatMoney(s.expense),
            formatMoney(s.advance - s.expense),
          ]),
        },
      ],
      filename: `moliya_${from}_${to}`,
    })
    toast({ title: 'PDF yuklandi', description: 'Fayl kompyuteringizga saqlandi' })
  }

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">Avans va xarajatlar</h1>
          <p className="text-sm text-muted-foreground">Obyektlarga kelgan pul va sarf-xarajatlar hisobi</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => openAdd('ADVANCE')}>
            <ArrowDownCircle className="h-4 w-4" /> Avans
          </Button>
          <Button className="gap-2" onClick={() => openAdd('EXPENSE')}>
            <ArrowUpCircle className="h-4 w-4" /> Xarajat
          </Button>
        </div>
      </div>

      {/* Jami kartalar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <ArrowDownCircle className="h-4 w-4" />
            <p className="text-xs font-medium">Avanslar (kirim)</p>
          </div>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-emerald-700 lg:text-xl">
            {loading ? '…' : `+${formatMoney(data?.totalAdvance ?? 0)}`}
            <span className="ml-1 text-xs font-normal text-muted-foreground">so&apos;m</span>
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-rose-700">
            <ArrowUpCircle className="h-4 w-4" />
            <p className="text-xs font-medium">Xarajatlar</p>
          </div>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-rose-700 lg:text-xl">
            {loading ? '…' : `-${formatMoney(data?.totalExpense ?? 0)}`}
            <span className="ml-1 text-xs font-normal text-muted-foreground">so&apos;m</span>
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-primary">
            {net >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <p className="text-xs font-medium">Qoldiq</p>
          </div>
          <p className={`mt-1.5 text-lg font-bold tabular-nums lg:text-xl ${net >= 0 ? 'text-foreground' : 'text-rose-700'}`}>
            {loading ? '…' : formatMoney(net)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">so&apos;m</span>
          </p>
        </Card>
      </div>

      {/* Filtrlar */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> Filtr
          {(typeFilter !== 'all' || siteFilter !== 'all' || from !== monthStartStr() || to !== todayStr()) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1 text-xs"
              onClick={() => {
                setTypeFilter('all')
                setSiteFilter('all')
                setFrom(monthStartStr())
                setTo(todayStr())
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
            <Label>Obyekt</Label>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha obyektlar</SelectItem>
                {data?.sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Turi</Label>
            <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="text-xs">Hammasi</TabsTrigger>
                <TabsTrigger value="ADVANCE" className="text-xs">Avans</TabsTrigger>
                <TabsTrigger value="EXPENSE" className="text-xs">Xarajat</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      {/* Eksport */}
      {hasData && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      )}

      {/* Obyektlar bo'yicha qisqa xulosa */}
      {data && data.bySite.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.bySite.map((s) => (
            <Card key={s.siteId} className="p-3.5">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                <Building2 className="h-4 w-4 shrink-0 text-primary" /> {s.siteName}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-50 py-1.5">
                  <p className="text-[10px] text-emerald-700/70">Avans</p>
                  <p className="font-semibold tabular-nums text-emerald-700">+{formatMoney(s.advance)}</p>
                </div>
                <div className="rounded-lg bg-rose-50 py-1.5">
                  <p className="text-[10px] text-rose-700/70">Xarajat</p>
                  <p className="font-semibold tabular-nums text-rose-700">-{formatMoney(s.expense)}</p>
                </div>
                <div className="rounded-lg bg-secondary py-1.5">
                  <p className="text-[10px] text-muted-foreground">Qoldiq</p>
                  <p className="font-semibold tabular-nums">{formatMoney(s.advance - s.expense)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Yozuvlar ro'yxati */}
      {loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : error && !data ? (
        <LoadError message={error} onRetry={refresh} />
      ) : !data || data.transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Banknote className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Tanlangan davrda avans yoki xarajat yo&apos;q.
              <br />
              &quot;Avans&quot; yoki &quot;Xarajat&quot; tugmasini bosib qo&apos;shing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop jadval */}
          <Card className="hidden sm:block">
            <div className="divide-y">
              {data.transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      t.type === 'ADVANCE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {t.type === 'ADVANCE' ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.category ?? (t.type === 'ADVANCE' ? 'Avans' : 'Xarajat')}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{t.site.name}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateUz(t.date)}
                      {t.note ? ` · ${t.note}` : ''}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      t.type === 'ADVANCE' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {t.type === 'ADVANCE' ? '+' : '-'}
                    {formatMoney(t.amount)} so&apos;m
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(t)}
                    aria-label="O'chirish"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* Mobil kartalar */}
          <div className="space-y-2 sm:hidden">
            {data.transactions.map((t) => (
              <Card key={t.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        t.type === 'ADVANCE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {t.type === 'ADVANCE' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.category ?? (t.type === 'ADVANCE' ? 'Avans' : 'Xarajat')}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{t.site.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDateUz(t.date)}</p>
                      {t.note && <p className="mt-0.5 truncate text-xs italic text-muted-foreground">{t.note}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        t.type === 'ADVANCE' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {t.type === 'ADVANCE' ? '+' : '-'}
                      {formatMoney(t.amount)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(t)}
                      aria-label="O'chirish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Qo'shish dialogi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.type === 'ADVANCE' ? "Yangi avans (kirim)" : 'Yangi xarajat'}</DialogTitle>
            <DialogDescription>
              Qaysi obyektga tegishli pul harakatini kiriting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Tur tanlash */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    type: 'ADVANCE',
                    category: ADVANCE_CATEGORIES[0],
                  }))
                }
                className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-all ${
                  form.type === 'ADVANCE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-border text-muted-foreground hover:border-emerald-200'
                }`}
              >
                <ArrowDownCircle className="h-4 w-4" /> Avans (kirim)
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    type: 'EXPENSE',
                    category: EXPENSE_CATEGORIES[0],
                  }))
                }
                className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-all ${
                  form.type === 'EXPENSE'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-border text-muted-foreground hover:border-rose-200'
                }`}
              >
                <ArrowUpCircle className="h-4 w-4" /> Xarajat
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Obyekt *</Label>
              <Select
                value={form.siteId}
                onValueChange={(v) => setForm((f) => ({ ...f, siteId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Obyektni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {data?.sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-amount">Summa (so&apos;m) *</Label>
                <Input
                  id="f-amount"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Masalan: 5000000"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-date">Sana</Label>
                <Input
                  id="f-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Kategoriya</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(form.type === 'ADVANCE' ? ADVANCE_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-note">Izoh</Label>
              <Textarea
                id="f-note"
                rows={2}
                placeholder="Masalan: 10 tonna sement, kimdan olindi va h.k."
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>

            {form.type === 'ADVANCE' && form.amount && Number(form.amount) > 0 && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Bu obyekt qoldig&apos;iga <b>+{formatMoney(Number(form.amount))} so&apos;m</b> qo&apos;shiladi
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O'chirish tasdiqlash */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Yozuvni o&apos;chirish?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{deleting && `${formatMoney(deleting.amount)} so'm`}</b> —{' '}
              {deleting?.category ?? (deleting?.type === 'ADVANCE' ? 'avans' : 'xarajat')} yozuvi o&apos;chiriladi.
              Bu amalni qaytarib bo&apos;lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete}>
              Ha, o&apos;chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
