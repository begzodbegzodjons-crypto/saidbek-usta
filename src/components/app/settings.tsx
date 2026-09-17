'use client'

import { useRef, useState } from 'react'
import {
  Settings, Building2, DownloadCloud, UploadCloud, ShieldCheck, Database,
  HardDrive, Clock, AlertTriangle, CheckCircle2, KeyRound, Eye, EyeOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useApi, apiSend, authHeaders } from '@/hooks/use-api'
import { formatDateTime } from '@/lib/format'
import type { SettingsData, DataStats } from '@/lib/types'

export default function SettingsPage() {
  const { data, loading, refresh, error } = useApi<SettingsData>('/api/settings')
  const { data: stats, refresh: refreshStats } = useApi<DataStats>('/api/stats')
  const [companyName, setCompanyName] = useState('')
  const [nameInitialized, setNameInitialized] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<{ text: string; json: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwShow, setPwShow] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const nameLock = useRef(false)
  const pwLock = useRef(false)
  const { toast } = useToast()

  // Firma nomini birinchi yuklashda inputga joylash
  if (data && !nameInitialized) {
    setCompanyName(data.companyName)
    setNameInitialized(true)
  }

  async function handleChangePassword() {
    if (pwLock.current) return // Ikki marta tez bosishdan himoya
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast({ title: 'Xatolik', description: 'Barcha maydonlarni to\u2018ldiring', variant: 'destructive' })
      return
    }
    if (pwNew !== pwConfirm) {
      toast({ title: 'Xatolik', description: 'Yangi parollar mos kelmadi', variant: 'destructive' })
      return
    }
    if (pwNew.trim().length < 4) {
      toast({ title: 'Xatolik', description: "Yangi parol kamida 4 belgidan iborat bo'lsin", variant: 'destructive' })
      return
    }
    pwLock.current = true
    setPwSaving(true)
    try {
      await apiSend('/api/auth/password', 'POST', {
        currentPassword: pwCurrent,
        newPassword: pwNew,
      })
      toast({ title: "Parol o'zgartirildi", description: 'Keyingi kirishda yangi parol ishlaydi' })
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : "Parolni o'zgartirishda xatolik", variant: 'destructive' })
    } finally {
      pwLock.current = false
      setPwSaving(false)
    }
  }

  async function handleSaveName() {
    if (nameLock.current) return // Ikki marta tez bosishdan himoya
    nameLock.current = true
    setSavingName(true)
    try {
      await apiSend('/api/settings', 'PUT', { companyName: companyName.trim() })
      toast({ title: 'Saqlandi', description: "Firma nomi yangilandi — hisobotlarda ko'rinadi" })
      refresh()
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : 'Saqlashda xatolik', variant: 'destructive' })
    } finally {
      nameLock.current = false
      setSavingName(false)
    }
  }

  async function handleBackupNow() {
    setBackingUp(true)
    try {
      await apiSend('/api/backup', 'POST')
      toast({ title: 'Zaxira yaratildi', description: 'Serverda xavfsiz saqlandi' })
      refresh()
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : 'Zaxira xatosi', variant: 'destructive' })
    } finally {
      setBackingUp(false)
    }
  }

  async function handleDownloadBackup() {
    try {
      // Token bilan yuklab olamiz — cookie bloklangan muhitlarda (preview iframe) ham ishlaydi
      const res = await fetch('/api/backup', { headers: authHeaders(), cache: 'no-store' })
      if (!res.ok) throw new Error(`Xatolik: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qurilpro-zaxira-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Yuklab olindi', description: 'Zaxira fayli kompyuteringizga tushdi' })
    } catch {
      toast({ title: 'Xatolik', description: 'Zaxirani yuklab olishda muammo bo\u2018ldi', variant: 'destructive' })
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      try {
        const json = JSON.parse(text)
        if (!json?.data || !Array.isArray(json.data.workers)) {
          throw new Error()
        }
        const counts = json.counts ?? {}
        setPendingRestore({
          text: `${counts.workers ?? json.data.workers.length} ishchi, ${counts.sites ?? json.data.sites.length} obyekt, ${counts.attendances ?? json.data.attendances.length} davomat, ${counts.payments ?? json.data.payments.length} to'lov`,
          json: text,
        })
      } catch {
        toast({
          title: "Fayl noto'g'ri",
          description: "Bu QurilPro zaxira fayli emas. Tizim bergan .json faylni tanlang.",
          variant: 'destructive',
        })
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  async function handleRestore() {
    if (!pendingRestore) return
    setRestoring(true)
    try {
      const json = JSON.parse(pendingRestore.json)
      await apiSend('/api/restore', 'POST', json)
      toast({
        title: "Ma'lumotlar tiklandi",
        description: "Barcha yozuvlar zaxiradan qayta yuklandi",
      })
      refresh()
      refreshStats()
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : 'Tiklashda xatolik', variant: 'destructive' })
    } finally {
      setRestoring(false)
      setPendingRestore(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold lg:text-2xl">Sozlamalar</h1>
        <p className="text-sm text-muted-foreground">Parol, firma nomi, zaxira nusxa va ma&apos;lumotlar xavfsizligi</p>
      </div>

      {/* Parol */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> Kirish paroli
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw-cur">Hozirgi parol</Label>
              <div className="relative">
                <Input
                  id="pw-cur"
                  type={pwShow ? 'text' : 'password'}
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  autoComplete="current-password"
                  className="pr-9"
                />
                {pwCurrent && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setPwShow((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Parolni ko'rsatish"
                  >
                    {pwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">Yangi parol</Label>
              <Input
                id="pw-new"
                type={pwShow ? 'text' : 'password'}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-conf">Yangi parol (takror)</Label>
              <Input
                id="pw-conf"
                type={pwShow ? 'text' : 'password'}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Parolni telefoningizga ham qayd etib qo&apos;ying — unutilsa tiklash imkoni yo&apos;q.
            </p>
            <Button
              onClick={handleChangePassword}
              disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
            >
              {pwSaving ? 'Saqlanmoqda...' : "Parolni o'zgartirish"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Firma nomi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> Firma nomi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="company">Hisobotlarda ko&apos;rinadigan nom</Label>
              <Input
                id="company"
                placeholder="Masalan: Boytemir Qurilish MChJ"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveName} disabled={savingName || companyName.trim() === data?.companyName}>
              {savingName ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zaxira nusxa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Zaxira nusxa va tiklash
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Himoya banneri */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-3.5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="text-sm">
              <p className="font-medium text-emerald-900">Ma&apos;lumotlaringiz himoyada</p>
              <p className="mt-0.5 text-emerald-800/80">
                Tizim har kuni o&apos;zi zaxira nusxa oladi (oxirgi 15 nusxa saqlanadi). Har bir saqlash
                tranzaksiyada bajariladi — bir vaqtda 10 ta telefon kiritganda ham hech narsa yo&apos;qolmaydi
                yoki aralashib ketmaydi.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-muted/70 p-3.5 text-sm">
            <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Oxirgi zaxira nusxa</p>
              {data?.lastBackup ? (
                <p className="mt-0.5 text-muted-foreground">
                  <Clock className="mr-1 inline h-3.5 w-3.5" />
                  {formatDateTime(data.lastBackup.createdAt)} · {(data.lastBackup.size / 1024).toFixed(1)} KB ·{' '}
                  {data.lastBackup.reason === 'auto'
                    ? 'avtomatik'
                    : data.lastBackup.reason === 'manual'
                      ? "qo'lda"
                      : 'tiklashdan oldin'}
                </p>
              ) : (
                <p className="mt-0.5 text-muted-foreground">Hozircha zaxira yo&apos;q — sahifa ochilganda o&apos;zi yaratiladi</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="gap-2" onClick={handleDownloadBackup}>
              <DownloadCloud className="h-4 w-4" /> Telefonga / kompyuterga yuklab olish
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleBackupNow} disabled={backingUp}>
              <Database className="h-4 w-4" /> {backingUp ? 'Yaratilmoqda...' : "Hozir serverga zaxiralash"}
            </Button>
          </div>

          {/* Tiklash */}
          <div className="rounded-lg border border-dashed p-3.5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Zaxiradan tiklash</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Yuklangan zaxira fayli hozirgi barcha ma&apos;lumotlarni almashtiradi. Tiklashdan oldin
                  tizim o&apos;zi hozirgi holatni zaxiralab oladi — shuning uchun xavfsiz.
                </p>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileSelect} />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2.5 gap-2"
                  onClick={() => fileRef.current?.click()}
                  disabled={restoring}
                >
                  <UploadCloud className="h-4 w-4" /> Zaxira faylni tanlash
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ma'lumotlar statistikasi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-primary" /> Baza holati
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatChip label="Ishchilar" value={stats?.workers ?? 0} />
            <StatChip label="Obyektlar" value={stats?.sites ?? 0} />
            <StatChip label="Davomat yozuvlari" value={stats?.attendances ?? 0} />
            <StatChip label="To'lovlar" value={stats?.payments ?? 0} />
            <StatChip label="Moliya yozuvlari" value={stats?.siteTransactions ?? 0} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Wal rejim + tranzaksiya
            </Badge>
            Har bir o&apos;zgarish diskka yoziladi — tok uzilsa yoki internet uzilsa ham saqlangan ma&apos;lumot yo&apos;qolmaydi.
          </p>
        </CardContent>
      </Card>

      {/* Tiklash tasdiqlash */}
      <AlertDialog open={!!pendingRestore} onOpenChange={(v) => !v && setPendingRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zaxiradan tiklashni tasdiqlaysizmi?</AlertDialogTitle>
            <AlertDialogDescription>
              Faylda: <b>{pendingRestore?.text}</b> mavjud. Tiklanganda hozirgi barcha ma&apos;lumotlar
              shu fayldagilar bilan almashtiriladi. Hozirgi holat avtomatik zaxiralanadi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring} className="bg-primary hover:bg-primary/90">
              {restoring ? 'Tiklanmoqda...' : 'Ha, tiklash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-center">
      <p className="text-lg font-bold tabular-nums">{value.toLocaleString('ru-RU')}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
