'use client'

import { useMemo, useRef, useState } from 'react'
import { Users, Plus, Search, Pencil, Trash2, Phone, HardHat, Wallet } from 'lucide-react'
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useApi, apiSend, newClientKey } from '@/hooks/use-api'
import { formatMoney } from '@/lib/format'
import LoadError from '@/components/app/load-error'
import type { Worker } from '@/lib/types'

const EMPTY_FORM = { fullName: '', phone: '', position: '', dailyRate: '', active: true }

export default function Workers() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Worker | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  // Har bir yangi ishchi uchun o'ziga xos kalit — qayta urinilsa ham ikki marta yozilmaydi
  const [clientKey, setClientKey] = useState('')
  const [deleting, setDeleting] = useState<Worker | null>(null)
  const { toast } = useToast()

  const query = statusFilter === 'active' ? '/api/workers?status=active' : '/api/workers'
  const { data: workers, loading, refresh, error } = useApi<Worker[]>(query)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s || !workers) return workers ?? []
    return workers.filter(
      (w) =>
        w.fullName.toLowerCase().includes(s) ||
        (w.phone ?? '').toLowerCase().includes(s) ||
        (w.position ?? '').toLowerCase().includes(s)
    )
  }, [workers, search])

  const totalDebt = filtered.reduce((s, w) => s + (w.balance && w.balance > 0 ? w.balance : 0), 0)

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setClientKey(newClientKey())
    setDialogOpen(true)
  }

  function openEdit(w: Worker) {
    setEditing(w)
    setForm({
      fullName: w.fullName,
      phone: w.phone ?? '',
      position: w.position ?? '',
      dailyRate: String(w.dailyRate ?? ''),
      active: w.active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (saveLock.current) return // Ikki marta tez bosishdan himoya
    if (!form.fullName.trim()) {
      toast({ title: 'Xatolik', description: "Ism-familiyani kiriting", variant: 'destructive' })
      return
    }
    saveLock.current = true
    setSaving(true)
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        position: form.position.trim(),
        dailyRate: form.dailyRate === '' ? 0 : Number(form.dailyRate),
        active: form.active,
        ...(editing ? {} : { clientKey }), // Yangi ishchi — ikki marta yozilmaslik uchun kalit bilan
      }
      if (editing) {
        await apiSend(`/api/workers/${editing.id}`, 'PATCH', payload)
        toast({ title: 'Saqlandi', description: `${payload.fullName} ma'lumotlari yangilandi` })
      } else {
        await apiSend('/api/workers', 'POST', payload)
        toast({ title: "Qo'shildi", description: `${payload.fullName} ishchilar ro'yxatiga qo'shildi` })
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
      await apiSend(`/api/workers/${deleting.id}`, 'DELETE')
      toast({ title: "O'chirildi", description: `${deleting.fullName} o'chirildi` })
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
          <h1 className="text-xl font-bold lg:text-2xl">Ishchilar</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} kishi · Qarzdorlik: <span className="font-semibold text-amber-700">{formatMoney(totalDebt)} so&apos;m</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-muted-foreground">Faol</span>
            <Switch checked={statusFilter === 'all'} onCheckedChange={(v) => setStatusFilter(v ? 'all' : 'active')} />
            <span className="text-sm text-muted-foreground">Barchasi</span>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Ishchi qo&apos;shish
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Ism, telefon yoki mutaxassislik bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error && !workers ? (
        <LoadError message={error} onRetry={refresh} />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Qidiruv bo\u2019yicha natija topilmadi' : "Hozircha ishchilar yo'q. Birinchi ishchini qo'shing."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop jadval */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ishchi</TableHead>
                  <TableHead>Mutaxassislik</TableHead>
                  <TableHead className="text-right">Kunlik haq</TableHead>
                  <TableHead className="text-center">Kunlar</TableHead>
                  <TableHead className="text-right">Ishlagan</TableHead>
                  <TableHead className="text-right">Olgan</TableHead>
                  <TableHead className="text-right">Qoldiq</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => (
                  <TableRow key={w.id} className={!w.active ? 'opacity-50' : ''}>
                    <TableCell>
                      <p className="font-medium">{w.fullName}</p>
                      {w.phone && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {w.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{w.position || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(w.dailyRate)}</TableCell>
                    <TableCell className="text-center tabular-nums">{w.daysWorked ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(w.earned ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{formatMoney(w.paid ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(w.balance ?? 0) > 0 ? (
                        <span className="font-semibold text-amber-700">+{formatMoney(w.balance ?? 0)}</span>
                      ) : (w.balance ?? 0) < 0 ? (
                        <span className="text-xs text-muted-foreground">To&apos;langan</span>
                      ) : (
                        <span className="text-xs text-emerald-600">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RowMenu onEdit={() => openEdit(w)} onDelete={() => setDeleting(w)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobil kartalar */}
          <div className="space-y-2 md:hidden">
            {filtered.map((w) => (
              <Card key={w.id} className={`p-4 ${!w.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{w.fullName}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {w.position && (
                        <span className="flex items-center gap-1">
                          <HardHat className="h-3 w-3" /> {w.position}
                        </span>
                      )}
                      {w.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {w.phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <RowMenu onEdit={() => openEdit(w)} onDelete={() => setDeleting(w)} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-2.5 text-xs">
                  <div>
                    <p className="text-muted-foreground">Kunlik haq</p>
                    <p className="font-semibold tabular-nums">{formatMoney(w.dailyRate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ishlangan kun</p>
                    <p className="font-semibold tabular-nums">{w.daysWorked ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ishlagan puli</p>
                    <p className="font-semibold tabular-nums">{formatMoney(w.earned ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Qoldiq</p>
                    {(w.balance ?? 0) > 0 ? (
                      <p className="font-semibold tabular-nums text-amber-700">+{formatMoney(w.balance ?? 0)}</p>
                    ) : (
                      <p className="font-semibold tabular-nums text-emerald-600">{formatMoney(w.balance ?? 0)}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Qo'shish / tahrirlash dialogi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Ishchini tahrirlash' : "Yangi ishchi qo'shish"}</DialogTitle>
            <DialogDescription>
              Ishchi ma&apos;lumotlarini kiriting. Kunlik haq avtomatik hisob-kitobda ishlatiladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="w-name">Ism-familiya *</Label>
              <Input
                id="w-name"
                placeholder="Masalan: Aliyev Sardor Baxtiyorovich"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="w-phone">Telefon</Label>
                <Input
                  id="w-phone"
                  placeholder="+998 90 123 45 67"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-pos">Mutaxassislik</Label>
                <Input
                  id="w-pos"
                  placeholder="Betonchi, duradgor..."
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-rate">Kunlik haq (so&apos;m)</Label>
              <Input
                id="w-rate"
                type="number"
                min="0"
                placeholder="Masalan: 250000"
                inputMode="numeric"
                value={form.dailyRate}
                onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="w-active" className="cursor-pointer">Faol</Label>
                <p className="text-xs text-muted-foreground">Faol ishchilar davomatda ko&apos;rinadi</p>
              </div>
              <Switch
                id="w-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Wallet className="mr-1 h-4 w-4" /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O'chirish tasdiqlash */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ishchini o&apos;chirish?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{deleting?.fullName}</b> o&apos;chirilsa, uning barcha davomat yozuvlari va to&apos;lovlari ham
              o&apos;chiriladi. Bu amalni qaytarib bo&apos;lmaydi. Agar ishchi ishlamay qilsa, uni &quot;Faol&quot;dan
              olib tashlash tavsiya etiladi.
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

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <span className="sr-only">Amallar</span>
          <span className="text-lg leading-none">⋯</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Tahrirlash
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> O&apos;chirish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
