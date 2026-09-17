'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, Plus, Trash2, FileSpreadsheet, FileText, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useApi, apiSend, useCompany, newClientKey } from '@/hooks/use-api'
import { formatMoney, formatDateUz, todayStr, monthStartStr } from '@/lib/format'
import { exportToExcel, exportToPDF } from '@/lib/export'
import LoadError from '@/components/app/load-error'
import type { Worker, Payment } from '@/lib/types'

export default function Payments() {
  const companyName = useCompany()
  const [workerFilter, setWorkerFilter] = useState('all')
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  // Har bir yangi to'lov uchun o'ziga xos kalit — qayta urinilsa ham pul ikki marta yozilmaydi
  const [clientKey, setClientKey] = useState('')
  const [form, setForm] = useState({ workerId: '', amount: '', date: todayStr(), note: '' })
  const { toast } = useToast()

  const { data: workers, refresh: refreshWorkers, error: workersError } = useApi<Worker[]>('/api/workers')
  const { data: payments, loading, refresh, error: paymentsError } = useApi<Payment[]>(
    `/api/payments?from=${from}&to=${to}${workerFilter !== 'all' ? `&workerId=${workerFilter}` : ''}`
  )

  const activeWorkers = useMemo(() => workers?.filter((w) => w.active) ?? [], [workers])
  const debtWorkers = useMemo(
    () => workers?.filter((w) => (w.balance ?? 0) > 0).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0)) ?? [],
    [workers]
  )
  const totalDebt = debtWorkers.reduce((s, w) => s + (w.balance ?? 0), 0)
  const filteredTotal = payments?.reduce((s, p) => s + p.amount, 0) ?? 0

  // Dialog ochilganda birinchi qarzdor ishchini tanlash + yangi clientKey berish
  useEffect(() => {
    if (dialogOpen) {
      setClientKey(newClientKey())
      setForm((f) => ({
        ...f,
        workerId: f.workerId || debtWorkers[0]?.id || activeWorkers[0]?.id || '',
        date: todayStr(),
      }))
    }
  }, [dialogOpen, debtWorkers, activeWorkers])

  async function handleSave() {
    if (saveLock.current) return // Ikki marta tez bosishdan himoya
    if (!form.workerId) {
      toast({ title: 'Xatolik', description: 'Ishchini tanlang', variant: 'destructive' })
      return
    }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      toast({ title: 'Xatolik', description: "To'lov summasini kiriting", variant: 'destructive' })
      return
    }
    saveLock.current = true
    setSaving(true)
    try {
      await apiSend('/api/payments', 'POST', {
        workerId: form.workerId,
        amount,
        date: form.date,
        note: form.note.trim(),
        clientKey,
      })
      const worker = workers?.find((w) => w.id === form.workerId)
      toast({ title: "To'lov qayd etildi", description: `${worker?.fullName}: ${formatMoney(amount)} so'm` })
      setDialogOpen(false)
      setForm({ workerId: '', amount: '', date: todayStr(), note: '' })
      setClientKey('')
      refresh()
      refreshWorkers()
    } catch (e) {
      toast({ title: 'Saqlanmadi', description: e instanceof Error ? e.message : "Saqlashda xatolik — ma'lumotlar saqlanib qoldi, qaytadan bosing", variant: 'destructive' })
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  async function deletePayment(id: string) {
    try {
      await apiSend(`/api/payments/${id}`, 'DELETE')
      toast({ title: "O'chirildi", description: "To'lov yozuvi o'chirildi" })
      refresh()
      refreshWorkers()
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : "O'chirishda xatolik", variant: 'destructive' })
    }
  }

  function exportExcel() {
    const list = payments ?? []
    exportToExcel(
      [
        {
          name: "To'lovlar",
          head: ['Sana', 'Ishchi', 'Summa', 'Izoh'],
          body: list.map((p) => [formatDateUz(p.date), p.worker.fullName, p.amount, p.note ?? '']),
        },
      ],
      `tolovlar_${from}_${to}`
    )
    toast({ title: 'Excel yuklandi', description: 'Fayl kompyuteringizga saqlandi' })
  }

  function exportPDF() {
    const list = payments ?? []
    exportToPDF({
      title: "To'lovlar hisoboti",
      subtitle: `${formatDateUz(from)} — ${formatDateUz(to)} · Jami: ${formatMoney(filteredTotal)} so'm`,
      company: companyName,
      sheets: [
        {
          head: ['Sana', 'Ishchi', "Summa (so'm)", 'Izoh'],
          body: list.map((p) => [formatDateUz(p.date), p.worker.fullName, formatMoney(p.amount), p.note ?? '']),
        },
      ],
      filename: `tolovlar_${from}_${to}`,
    })
    toast({ title: 'PDF yuklandi', description: 'Fayl kompyuteringizga saqlandi' })
  }

  const selectedWorker = workers?.find((w) => w.id === form.workerId)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">To&apos;lovlar</h1>
          <p className="text-sm text-muted-foreground">
            Tanlangan davr: <span className="font-semibold">{formatMoney(filteredTotal)} so&apos;m</span>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> To&apos;lov qo&apos;shish
        </Button>
      </div>

      {/* Qarzdorlik kartalari */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 text-amber-600" /> Qarzdorlik bo&apos;yicha ishchilar
          </p>
          <Badge className="bg-amber-100/80 text-amber-800 hover:bg-amber-100/80 tabular-nums">
            Jami: {formatMoney(totalDebt)} so&apos;m
          </Badge>
        </div>
        {debtWorkers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Qarzdorlik yo&apos;q</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {debtWorkers.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setWorkerFilter(w.id)
                  setFrom(monthStartStr())
                }}
                className="min-w-40 shrink-0 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50"
              >
                <p className="truncate text-sm font-medium">{w.fullName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{w.position || 'Ishchi'}</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-amber-700">+{formatMoney(w.balance ?? 0)}</p>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Filtr */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Ishchi</Label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
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
            <Label>Dan (sana)</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gacha (sana)</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel} disabled={!payments || payments.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPDF} disabled={!payments || payments.length === 0}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </Card>

      {/* To'lovlar ro'yxati */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : paymentsError && !payments ? (
        <LoadError message={paymentsError} onRetry={refresh} />
      ) : !payments || payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Bu davrda to&apos;lovlar yo&apos;q</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sana</TableHead>
                <TableHead>Ishchi</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead>Izoh</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateUz(p.date)}</TableCell>
                  <TableCell className="font-medium">{p.worker.fullName}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-emerald-700">
                    −{formatMoney(p.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note || '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deletePayment(p.id)}
                      title="O'chirish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {/* Mobil kartalar */}
      {!loading && payments && payments.length > 0 && (
        <div className="space-y-2 md:hidden">
          {payments.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.worker.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateUz(p.date)} {p.note ? `· ${p.note}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-emerald-700">−{formatMoney(p.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deletePayment(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* To'lov dialogi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi to&apos;lov</DialogTitle>
            <DialogDescription>Ishchiga berilgan pulni qayd eting — qarzdorlik avtomatik kamayadi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ishchi *</Label>
              <Select value={form.workerId || undefined} onValueChange={(v) => setForm({ ...form, workerId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Ishchini tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {activeWorkers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.fullName}{(w.balance ?? 0) > 0 ? ` (qarz: ${formatMoney(w.balance ?? 0)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedWorker && (
                <p className="text-xs text-muted-foreground">
                  Ishlagan: <b>{formatMoney(selectedWorker.earned ?? 0)}</b> · Olgan:{' '}
                  <b>{formatMoney(selectedWorker.paid ?? 0)}</b> · Qoldiq:{' '}
                  <b className="text-amber-700">{formatMoney(selectedWorker.balance ?? 0)}</b> so&apos;m
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-amount">Summa (so&apos;m) *</Label>
                <Input
                  id="p-amount"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Masalan: 500000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-date">Sana *</Label>
                <Input id="p-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-note">Izoh</Label>
              <Input
                id="p-note"
                placeholder="Masalan: naqd, plastik kartadan..."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            {form.amount && selectedWorker && Number(form.amount) > 0 && (
              <div className="rounded-lg bg-secondary/70 p-3 text-sm">
                To&apos;lovdan keyin qoldiq:{' '}
                <b className="tabular-nums">
                  {formatMoney((selectedWorker.balance ?? 0) - Number(form.amount))} so&apos;m
                </b>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saqlanmoqda...' : "To'lovni saqlash"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
