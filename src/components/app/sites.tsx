'use client'

import { useRef, useState } from 'react'
import { Building2, Plus, MapPin, UserCheck, Pencil, Trash2, CalendarClock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useApi, apiSend, newClientKey } from '@/hooks/use-api'
import { formatMoney } from '@/lib/format'
import LoadError from '@/components/app/load-error'
import type { Site } from '@/lib/types'

const EMPTY_FORM = { name: '', address: '', client: '', active: true }

export default function Sites() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Site | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  // Har bir yangi obyekt uchun o'ziga xos kalit — qayta urinilsa ham ikki marta yozilmaydi
  const [clientKey, setClientKey] = useState('')
  const [deleting, setDeleting] = useState<Site | null>(null)
  const { toast } = useToast()

  const { data: sites, loading, refresh, error } = useApi<Site[]>('/api/sites')

  const activeCount = sites?.filter((s) => s.active).length ?? 0
  const totalCost = sites?.reduce((s, x) => s + (x.totalCost ?? 0), 0) ?? 0
  const totalAdvance = sites?.reduce((s, x) => s + (x.totalAdvance ?? 0), 0) ?? 0
  const totalExpense = sites?.reduce((s, x) => s + (x.totalExpense ?? 0), 0) ?? 0

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setClientKey(newClientKey())
    setDialogOpen(true)
  }

  function openEdit(s: Site) {
    setEditing(s)
    setForm({ name: s.name, address: s.address ?? '', client: s.client ?? '', active: s.active })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (saveLock.current) return // Ikki marta tez bosishdan himoya
    if (!form.name.trim()) {
      toast({ title: 'Xatolik', description: 'Obyekt nomini kiriting', variant: 'destructive' })
      return
    }
    saveLock.current = true
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        client: form.client.trim(),
        active: form.active,
        ...(editing ? {} : { clientKey }), // Yangi obyekt — ikki marta yozilmaslik uchun kalit bilan
      }
      if (editing) {
        await apiSend(`/api/sites/${editing.id}`, 'PATCH', payload)
        toast({ title: 'Saqlandi', description: `${payload.name} yangilandi` })
      } else {
        await apiSend('/api/sites', 'POST', payload)
        toast({ title: "Qo'shildi", description: `${payload.name} obyektlar ro'yxatiga qo'shildi` })
      }
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
      await apiSend(`/api/sites/${deleting.id}`, 'DELETE')
      toast({ title: "O'chirildi", description: `${deleting.name} o'chirildi` })
      refresh()
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : "O'chirishda xatolik", variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">Obyektlar</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} faol · Avans: <span className="font-semibold text-emerald-700">{formatMoney(totalAdvance)}</span> · Xarajat: <span className="font-semibold text-rose-700">{formatMoney(totalExpense)}</span> · Ish haqi: <span className="font-semibold">{formatMoney(totalCost)} so&apos;m</span>
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Obyekt qo&apos;shish
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : error && !sites ? (
        <LoadError message={error} onRetry={refresh} />
      ) : sites && sites.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => (
            <Card key={s.id} className={`flex flex-col p-4 transition-shadow hover:shadow-md ${!s.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    {s.address && (
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" /> {s.address}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <span className="sr-only">Amallar</span>
                      <span className="text-lg leading-none">⋯</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(s)}>
                      <Pencil className="mr-2 h-4 w-4" /> Tahrirlash
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleting(s)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> O&apos;chirish
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {s.client && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5" /> Mijoz: {s.client}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-2.5 text-xs">
                <div>
                  <p className="text-muted-foreground">Ish kun-davomati</p>
                  <p className="font-semibold tabular-nums">{s.workerDays ?? 0} kun</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ish haqi sarfi</p>
                  <p className="font-semibold tabular-nums">{formatMoney(s.totalCost ?? 0)} so&apos;m</p>
                </div>
              </div>

              {(s.totalAdvance || s.totalExpense) ? (
                <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg border border-dashed p-2.5 text-center text-[11px]">
                  <div>
                    <p className="text-emerald-700/70">Avans</p>
                    <p className="font-semibold tabular-nums text-emerald-700">+{formatMoney(s.totalAdvance ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-rose-700/70">Xarajat</p>
                    <p className="font-semibold tabular-nums text-rose-700">-{formatMoney(s.totalExpense ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Qoldiq</p>
                    <p className={`font-semibold tabular-nums ${(s.balance ?? 0) < 0 ? 'text-rose-700' : ''}`}>
                      {formatMoney(s.balance ?? 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Moliya yozuvi yo&apos;q — Moliya bo&apos;limida avans/xarajat qo&apos;shing
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                {s.active ? (
                  <Badge className="bg-emerald-100/80 text-emerald-800 hover:bg-emerald-100/80">Faol</Badge>
                ) : (
                  <Badge variant="secondary">Tugagan</Badge>
                )}
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {new Date(s.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Hozircha obyektlar yo&apos;q. Birinchi obyektni qo&apos;shing.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Obyektni tahrirlash' : "Yangi obyekt qo'shish"}</DialogTitle>
            <DialogDescription>Ish joyi haqidagi ma&apos;lumotlarni kiriting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Obyekt nomi *</Label>
              <Input
                id="s-name"
                placeholder="Masalan: Yunusobod 4-kvartal, 12-dom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-addr">Manzil</Label>
              <Input
                id="s-addr"
                placeholder="Tuman, ko'cha, mo'ljal"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-client">Mijoz / buyurtmachi</Label>
              <Input
                id="s-client"
                placeholder="Masalan: Aliyev Boyxodir"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="s-active" className="cursor-pointer">Faol</Label>
                <p className="text-xs text-muted-foreground">Faol obyektlar davomatda tanlanadi</p>
              </div>
              <Switch id="s-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O'chirish tasdiqlash */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obyektni o&apos;chirish?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{deleting?.name}</b> o&apos;chirilsa, shu obyektga tegishli barcha davomat yozuvlari ham o&apos;chiriladi
              va hisob-kitoblar o&apos;zgaradi. Bu amalni qaytarib bo&apos;lmaydi.
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
