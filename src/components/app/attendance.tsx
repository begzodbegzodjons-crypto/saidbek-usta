'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardCheck, CalendarDays, CheckCircle2, XCircle, Save, RotateCcw, CheckCheck,
  Trash2, MapPin, FileSpreadsheet, FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useApi, apiSend, useCompany } from '@/hooks/use-api'
import { formatMoney, formatDateUz, weekdayUz, todayStr, monthStartStr } from '@/lib/format'
import { exportToExcel, exportToPDF } from '@/lib/export'
import LoadError from '@/components/app/load-error'
import { cn } from '@/lib/utils'
import type { Worker, Site, AttendanceRecord } from '@/lib/types'

interface Mark {
  status: 'PRESENT' | 'ABSENT' | null
  rate: string
  siteId: string
}

// Qoralama — telefon brauzeri sahifani qayta yuklaganda (xotira bosimi, dasturni almashtirish)
// belgilangan davomat YO'QOLMAYDI: har o'zgarish brauzer xotirasiga avtomatik yozib boriladi
const DRAFT_KEY = 'qp_attendance_draft'

interface Draft {
  date: string
  siteId: string
  marks: Record<string, Mark>
  cleared: boolean
  savedAt: number
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

export default function Attendance() {
  const companyName = useCompany()
  const [date, setDate] = useState(todayStr())
  const [siteId, setSiteId] = useState('')
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const draftToastShown = useRef(false)
  // Serverdan yuklangan holat nusxasi — "saqlanmagan o'zgarish bor/yo'q"ni aniqlash uchun
  const serverMarksRef = useRef<Record<string, Mark>>({})
  const [historyMonth, setHistoryMonth] = useState(todayStr().slice(0, 7))
  const [historySite, setHistorySite] = useState('all')
  const { toast } = useToast()

  const { data: workers, loading: workersLoading, error: workersError, refresh: refreshWorkers } = useApi<Worker[]>('/api/workers?status=active')
  const { data: sites, error: sitesError } = useApi<Site[]>('/api/sites?status=active')
  const { data: dayRecords, loading: dayLoading, refresh: refreshDay } = useApi<AttendanceRecord[]>(
    date ? `/api/attendance?date=${date}` : null
  )

  const activeSites = useMemo(() => sites?.filter((s) => s.active) ?? [], [sites])

  // Obyekt tanlanmagan bo'lsa — birinchi faol obyektni tanlash
  useEffect(() => {
    if (!siteId && activeSites.length > 0) {
      setSiteId(activeSites[0].id)
    }
  }, [activeSites, siteId])

  // Shu kundagi BARCHA yozuvlar — har ishchi o'z obyekti bilan yuklanadi + qoralama tiklanadi
  useEffect(() => {
    if (!dayRecords || dayLoading) return
    let next: Record<string, Mark> = {}
    for (const r of dayRecords) {
      next[r.workerId] = {
        status: r.status,
        rate: String(r.dayRate ?? r.worker.dailyRate ?? ''),
        siteId: r.siteId,
      }
    }
    serverMarksRef.current = next // server holati — dirty hisoblash uchun
    // Qoralamani tiklash — foydalanuvchi ilgari belgilab, saqlamasdan sahifani yangilagan bo'lsa
    let restored = false
    let restoredCleared = false
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw) as Draft
        if (d?.date === date && d?.marks) {
          if (d.cleared) {
            // Foydalanuvchi kunni tozalab edi — bo'sh holatni tiklaymiz
            if (dayRecords.length > 0) restoredCleared = true
            next = {}
          } else if (Object.keys(d.marks).length > 0) {
            const same = JSON.stringify(next) === JSON.stringify(d.marks)
            if (!same) {
              next = { ...next, ...d.marks }
              restored = true
            }
          }
        }
      }
    } catch {
      // Buzuq qoralama — e'tiborsiz
    }
    setMarks(next)
    setRemovedIds([])
    if ((restored || restoredCleared) && !draftToastShown.current) {
      draftToastShown.current = true
      toast({
        title: 'Saqlanmagan belgilashlar tiklandi',
        description: restoredCleared
          ? 'Kun tozalangan holati qayta tiklandi. Saqlash uchun tugmani bosing.'
          : 'Oldingi sessiyada belgilaganlaringiz qayta tiklandi — saqlash tugmasini bosing.',
      })
    }
  }, [dayRecords, dayLoading, date, toast])

  // Qoralamani avtomatik saqlash — har belgilash/o'zgartirish darhol brauzer xotirasiga yoziladi
  useEffect(() => {
    if (dayLoading || !dayRecords) return
    const cleared = Object.keys(marks).length === 0 && dayRecords.length > 0
    try {
      const draft: Draft = { date, siteId, marks, cleared, savedAt: Date.now() }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Xotira bloklangan — davomat o'zi ishlaydi
    }
  }, [date, siteId, marks, dayLoading, dayRecords])

  const presentCount = Object.values(marks).filter((m) => m.status === 'PRESENT').length
  const absentCount = Object.values(marks).filter((m) => m.status === 'ABSENT').length
  const markedCount = presentCount + absentCount
  const totalCost = Object.entries(marks).reduce((s, [, m]) => (m.status === 'PRESENT' ? s + (Number(m.rate) || 0) : s), 0)

  // Saqlanmagan o'zgarishlar bormi? (server holatidan farq qilsa yoki o'chirilgan yozuv bo'lsa)
  const dirty = useMemo(
    () => removedIds.length > 0 || JSON.stringify(marks) !== JSON.stringify(serverMarksRef.current),
    [marks, removedIds]
  )

  // Ishchilar qaysi obyektlarga tarqalgani (xulosa qatori)
  const perSiteCounts = useMemo(() => {
    const map: Record<string, { name: string; present: number; absent: number }> = {}
    for (const m of Object.values(marks)) {
      const sid = m.siteId || siteId
      if (!sid) continue
      if (!map[sid]) {
        map[sid] = { name: activeSites.find((s) => s.id === sid)?.name ?? 'Obyekt', present: 0, absent: 0 }
      }
      if (m.status === 'PRESENT') map[sid].present += 1
      else if (m.status === 'ABSENT') map[sid].absent += 1
    }
    return Object.values(map)
  }, [marks, activeSites, siteId])

  function setMark(worker: Worker, status: 'PRESENT' | 'ABSENT' | null) {
    setMarks((prev) => {
      const next = { ...prev }
      if (status === null) {
        delete next[worker.id]
      } else {
        next[worker.id] = {
          status,
          rate: prev[worker.id]?.rate ?? String(worker.dailyRate ?? ''),
          siteId: prev[worker.id]?.siteId ?? siteId,
        }
      }
      return next
    })
  }

  function setWorkerSite(workerId: string, sid: string) {
    setMarks((prev) => {
      const next = { ...prev }
      const existing = next[workerId]
      if (existing) {
        next[workerId] = { ...existing, siteId: sid }
      } else {
        // Obyekt oldindan tanlanadi — status belgilangach saqlanadi
        next[workerId] = { status: null, rate: '', siteId: sid }
      }
      return next
    })
  }

  function setRate(workerId: string, rate: string) {
    setMarks((prev) => {
      const existing = prev[workerId]
      if (!existing) return prev
      return { ...prev, [workerId]: { ...existing, rate } }
    })
  }

  function markAllPresent() {
    if (!workers || !siteId) return
    const next: Record<string, Mark> = { ...marks }
    for (const w of workers) {
      const existing = next[w.id]
      next[w.id] = {
        status: 'PRESENT',
        rate: existing?.rate ?? String(w.dailyRate ?? ''),
        siteId: existing?.siteId || siteId,
      }
    }
    setMarks(next)
  }

  function clearAll() {
    const ids = dayRecords?.map((r) => r.id) ?? []
    setRemovedIds((prev) => [...prev, ...ids])
    setMarks({})
    // Tozalash qarorini ham qoralamaga yozamiz — yangilansa ham yo'qolmaydi
    try {
      const draft: Draft = { date, siteId, marks: {}, cleared: true, savedAt: Date.now() }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // bo'ldi
    }
  }

  // Saqlanmagan belgilar bilan sahifani tark etishdan ogohlantirish (telefon/kompyuter bir xil)
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  async function handleSave() {
    if (saveLock.current) return // Ikki marta tez bosish — ikki marta saqlanmasligi uchun
    const entries = Object.entries(marks)
      .filter(([, m]) => m.status !== null)
      .map(([workerId, m]) => ({
        workerId,
        status: m.status as 'PRESENT' | 'ABSENT',
        siteId: m.siteId || siteId,
        dayRate: m.rate === '' ? null : Number(m.rate),
      }))
    // Belgilash olib tashlangan ishchilarning eski yozuvlari ham o'chiriladi —
    // aks holda saqlagandan keyin "eski holat qaytdi"dek ko'rinadi
    const markedWorkerIds = new Set(entries.map((e) => e.workerId))
    const serverOnlyIds = (dayRecords ?? []).filter((r) => !markedWorkerIds.has(r.workerId)).map((r) => r.id)
    const toDelete = [...new Set([...removedIds, ...serverOnlyIds])]
    const hasRemovals = toDelete.length > 0
    if (entries.length === 0 && !hasRemovals) {
      toast({ title: 'Belgilanmagan', description: "Kamida bitta ishchini 'Keldi' yoki 'Kelmadi' deb belgilang", variant: 'destructive' })
      return
    }
    if (entries.some((e) => !e.siteId)) {
      toast({ title: 'Xatolik', description: 'Har bir ishchi uchun obyektni tanlang', variant: 'destructive' })
      return
    }
    saveLock.current = true
    setSaving(true)
    try {
      for (const id of toDelete) {
        await apiSend(`/api/attendance/${id}`, 'DELETE')
      }
      if (entries.length > 0) {
        await apiSend('/api/attendance', 'POST', { date, entries })
      }
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* bo'ldi */ }
      toast({
        title: 'Davomat saqlandi',
        description: `${formatDateUz(date)}: ${presentCount} keldi, ${absentCount} kelmadi${hasRemovals && entries.length === 0 ? ' · yozuvlar tozalandi' : ''}${entries.length > 0 ? ` · ${formatMoney(totalCost)} so'm` : ''}`,
      })
      refreshDay()
    } catch (e) {
      toast({ title: 'Saqlanmadi', description: e instanceof Error ? e.message : 'Saqlashda xatolik — belgilangan holat saqlanib qoldi, qaytadan bosing', variant: 'destructive' })
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  // ===== Tarix =====
  const { from: hFrom, to: hTo } = monthRange(historyMonth)
  const historyUrl = `/api/attendance?from=${hFrom}&to=${hTo}${historySite !== 'all' ? `&siteId=${historySite}` : ''}`
  const { data: history, loading: historyLoading, refresh: refreshHistory } = useApi<AttendanceRecord[]>(historyUrl)

  const hTotals = useMemo(() => {
    const records = history ?? []
    const present = records.filter((r) => r.status === 'PRESENT')
    return {
      present: present.length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      cost: present.reduce((s, r) => s + (r.dayRate ?? r.worker.dailyRate ?? 0), 0),
    }
  }, [history])

  async function deleteRecord(id: string) {
    try {
      await apiSend(`/api/attendance/${id}`, 'DELETE')
      toast({ title: "O'chirildi", description: 'Davomat yozuvi o\u2018chirildi' })
      refreshHistory()
      refreshDay()
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : "O'chirishda xatolik", variant: 'destructive' })
    }
  }

  function exportHistoryExcel() {
    const records = history ?? []
    exportToExcel(
      [
        {
          name: 'Davomat',
          head: ['Sana', 'Hafta kuni', 'Ishchi', 'Mutaxassislik', 'Obyekt', 'Holat', 'Kunlik haq', 'Summa', 'Izoh'],
          body: records.map((r) => [
            formatDateUz(r.date),
            weekdayUz(r.date),
            r.worker.fullName,
            r.worker.position ?? '',
            r.site.name,
            r.status === 'PRESENT' ? 'Keldi' : 'Kelmadi',
            r.status === 'PRESENT' ? (r.dayRate ?? r.worker.dailyRate ?? 0) : 0,
            r.status === 'PRESENT' ? (r.dayRate ?? r.worker.dailyRate ?? 0) : 0,
            r.note ?? '',
          ]),
        },
      ],
      `davomat_${historyMonth}`
    )
    toast({ title: 'Excel yuklandi', description: 'Fayl kompyuteringizga saqlandi' })
  }

  function exportHistoryPDF() {
    const records = history ?? []
    exportToPDF({
      title: 'Davomat hisoboti',
      subtitle: `${historyMonth} · ${historySite !== 'all' ? activeSites.find((s) => s.id === historySite)?.name ?? '' : 'Barcha obyektlar'} · Keldi: ${hTotals.present} · Kelmadi: ${hTotals.absent} · Summa: ${formatMoney(hTotals.cost)} so'm`,
      company: companyName,
      landscape: true,
      sheets: [
        {
          head: ['Sana', 'Ishchi', 'Obyekt', 'Holat', 'Summa'],
          body: records.map((r) => [
            formatDateUz(r.date),
            r.worker.fullName,
            r.site.name,
            r.status === 'PRESENT' ? 'Keldi' : 'Kelmadi',
            r.status === 'PRESENT' ? formatMoney(r.dayRate ?? r.worker.dailyRate ?? 0) : '-',
          ]),
        },
      ],
      filename: `davomat_${historyMonth}`,
    })
    toast({ title: 'PDF yuklandi', description: 'Fayl kompyuteringizga saqlandi' })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold lg:text-2xl">Davomat</h1>
        <p className="text-sm text-muted-foreground">Har bir ishchini obektga biriktirib, keldi/kelmadi deb belgilang</p>
      </div>

      {/* Belgilash paneli */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Davomat belgilash
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Sana</Label>
              <div className="flex gap-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Button variant="outline" size="icon" title="Bugun" onClick={() => setDate(todayStr())} className="shrink-0">
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>
                Asosiy obyekt <span className="font-normal text-muted-foreground">(yangi belgilashlar uchun)</span>
              </Label>
              <Select value={siteId || undefined} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Obyektni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {activeSites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex w-full gap-2">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={markAllPresent} disabled={!workers || workers.length === 0 || !siteId} title="Asosiy obyektga hammaga Keldi">
                  <CheckCheck className="h-4 w-4" /> Hammaga &quot;Keldi&quot;
                </Button>
                <Button variant="outline" size="icon" title="Tozalash" onClick={clearAll} className="shrink-0">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-secondary/70 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100/80 text-emerald-800 hover:bg-emerald-100/80">Keldi: {presentCount}</Badge>
              <Badge className="bg-rose-100/80 text-rose-700 hover:bg-rose-100/80">Kelmadi: {absentCount}</Badge>
              <span className="ml-auto font-semibold tabular-nums">
                Kunlik suma: {formatMoney(totalCost)} so&apos;m
              </span>
            </div>
            {perSiteCounts.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                {perSiteCounts.map((s) => (
                  <span key={s.name} className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary" />
                    {s.name}: <b className="tabular-nums">{s.present}</b> keldi
                    {s.absent > 0 && <>, <b className="tabular-nums">{s.absent}</b> kelmadi</>}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ishchilar ro'yxati */}
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {workersLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : workersError ? (
              <LoadError message={workersError} onRetry={refreshWorkers} />
            ) : sitesError ? (
              <LoadError message={sitesError} />
            ) : !workers || workers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Faol ishchilar yo&apos;q. Avval &quot;Ishchilar&quot; bo&apos;limida ishchi qo&apos;shing.
              </p>
            ) : (
              workers.map((w) => {
                const mark = marks[w.id]
                return (
                  <div
                    key={w.id}
                    className={`flex flex-col gap-2 rounded-lg border p-2.5 transition-colors sm:flex-row sm:items-center ${
                      mark?.status === 'PRESENT'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : mark?.status === 'ABSENT'
                          ? 'border-red-200 bg-red-50/50'
                          : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.position || 'Ishchi'} · {formatMoney(w.dailyRate)} so&apos;m/kun
                      </p>
                      {/* Qaysi obyektga yuborilgani — shu yerda belgilanadi */}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <Select
                          value={mark?.siteId || undefined}
                          onValueChange={(v) => setWorkerSite(w.id, v)}
                        >
                          <SelectTrigger className="h-7 w-full max-w-56 gap-1 border-dashed text-xs [&>svg]:h-3.5 [&>svg]:w-3.5">
                            <SelectValue placeholder="Qaysi obyektga yuborildi?" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeSites.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  {s.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        className="h-8 w-28 text-right text-xs tabular-nums"
                        title="Kunlik haq (shu kun uchun o'zgartirish mumkin)"
                        value={mark?.rate ?? ''}
                        placeholder={String(w.dailyRate ?? '')}
                        onChange={(e) => setRate(w.id, e.target.value)}
                        onFocus={() => !mark && setMark(w, 'PRESENT')}
                      />
                      <Button
                        size="sm"
                        variant={mark?.status === 'PRESENT' ? 'default' : 'outline'}
                        className={`h-8 gap-1 ${mark?.status === 'PRESENT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:bg-emerald-50'}`}
                        onClick={() => setMark(w, mark?.status === 'PRESENT' ? null : 'PRESENT')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Keldi
                      </Button>
                      <Button
                        size="sm"
                        variant={mark?.status === 'ABSENT' ? 'destructive' : 'outline'}
                        className="h-8 gap-1"
                        onClick={() => setMark(w, mark?.status === 'ABSENT' ? null : 'ABSENT')}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Kelmadi
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Saqlash paneli — telefonda doim ko'rinib turadi (sticky), uzun ro'yxatdan keyin ham yo'qolmaydi */}
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-2',
              'sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-3 rounded-xl border bg-card/95 px-3 py-2.5 shadow-lg shadow-black/5 backdrop-blur',
              'lg:static lg:bottom-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:backdrop-blur-0'
            )}
          >
            <p className="text-xs text-muted-foreground">
              {dirty && markedCount > 0 && !saving
                ? `Saqlanmagan: ${markedCount} ta belgilash`
                : dirty && removedIds.length > 0 && !saving
                  ? 'O\u2018chirilgan yozuvlar saqlanishi kerak'
                  : 'Obyekt tanlanmagan ishchi asosiy obyektga yoziladi'}
            </p>
            <Button onClick={handleSave} disabled={saving || !dirty} className="min-w-44 gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saqlanmoqda...' : dirty && markedCount > 0 ? `Saqlash (${markedCount})` : 'Davomatni saqlash'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tarix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>Davomat tarixi</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportHistoryExcel} disabled={!history || history.length === 0}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportHistoryPDF} disabled={!history || history.length === 0}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardTitle>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Input
              type="month"
              value={historyMonth}
              onChange={(e) => setHistoryMonth(e.target.value || todayStr().slice(0, 7))}
              className="sm:w-44"
            />
            <Select value={historySite} onValueChange={setHistorySite}>
              <SelectTrigger className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha obyektlar</SelectItem>
                {activeSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge className="bg-emerald-100/80 text-emerald-800 hover:bg-emerald-100/80">Keldi: {hTotals.present}</Badge>
            <Badge variant="destructive">Kelmadi: {hTotals.absent}</Badge>
            <Badge variant="secondary" className="tabular-nums">Summa: {formatMoney(hTotals.cost)} so&apos;m</Badge>
          </div>

          {historyLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !history || history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu davrda davomat yozuvlari yo&apos;q</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Ishchi</TableHead>
                    <TableHead className="hidden sm:table-cell">Obyekt</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateUz(r.date)}
                        <span className="block text-[11px] text-muted-foreground">{weekdayUz(r.date)}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{r.worker.fullName}</span>
                        <span className="block text-[11px] text-muted-foreground sm:hidden">{r.site.name}</span>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{r.site.name}</TableCell>
                      <TableCell>
                        {r.status === 'PRESENT' ? (
                          <Badge className="bg-emerald-100/80 text-emerald-800 hover:bg-emerald-100/80">Keldi</Badge>
                        ) : (
                          <Badge className="bg-rose-100/80 text-rose-700 hover:bg-rose-100/80">Kelmadi</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {r.status === 'PRESENT' ? formatMoney(r.dayRate ?? r.worker.dailyRate) : '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteRecord(r.id)}
                          title="O'chirish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
