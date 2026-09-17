import { mkdir, readdir, writeFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { db } from '@/lib/db'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')
const MAX_BACKUPS = 15
const AUTO_INTERVAL_MS = 20 * 60 * 60 * 1000 // 20 soat

export function getBackupDir(): string {
  if (!existsSync(BACKUP_DIR)) {
    // mkdir sync emas — async wrapper ishlatamiz chaqiruv tomonida
  }
  return BACKUP_DIR
}

export interface BackupFile {
  filename: string
  size: number
  createdAt: string
  reason: string
}

// Barcha jadvallarni to'liq JSON ko'rinishiga o'tkazish
export async function exportAllData() {
  const [workers, sites, attendances, payments, siteTransactions, settings] = await Promise.all([
    db.worker.findMany(),
    db.site.findMany(),
    db.attendance.findMany(),
    db.payment.findMany(),
    db.siteTransaction.findMany(),
    db.setting.findMany(),
  ])
  return {
    app: 'QurilPro',
    version: 2,
    exportedAt: new Date().toISOString(),
    counts: {
      workers: workers.length,
      sites: sites.length,
      attendances: attendances.length,
      payments: payments.length,
      siteTransactions: siteTransactions.length,
      settings: settings.length,
    },
    data: { workers, sites, attendances, payments, siteTransactions, settings },
  }
}

// Server tomonda zaxira fayl yaratish (avtomatik yoki qo'lda)
export async function createServerBackup(reason: 'auto' | 'manual' | 'before-restore'): Promise<BackupFile> {
  await mkdir(BACKUP_DIR, { recursive: true })
  const payload = await exportAllData()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `zaxira_${stamp}_${reason}.json`
  await writeFile(path.join(BACKUP_DIR, filename), JSON.stringify(payload), 'utf8')
  await rotateBackups()
  const s = await stat(path.join(BACKUP_DIR, filename))
  return { filename, size: s.size, createdAt: new Date().toISOString(), reason }
}

// Oxirgi zaxira fayli ma'lumoti
export async function getLastBackup(): Promise<BackupFile | null> {
  try {
    const files = await readdir(BACKUP_DIR)
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse()
    if (jsonFiles.length === 0) return null
    const filename = jsonFiles[0]
    const s = await stat(path.join(BACKUP_DIR, filename))
    const reason = filename.includes('auto') ? 'auto' : filename.includes('manual') ? 'manual' : 'before-restore'
    return { filename, size: s.size, createdAt: s.mtime.toISOString(), reason }
  } catch {
    return null
  }
}

// Oxirgi zaxiradan beri 20+ soat o'lgan bo'lsa — avtomatik zaxira yaratish
export async function autoBackupIfNeeded(): Promise<BackupFile | null> {
  try {
    const last = await getLastBackup()
    if (!last || Date.now() - new Date(last.createdAt).getTime() > AUTO_INTERVAL_MS) {
      return await createServerBackup('auto')
    }
    return null
  } catch (e) {
    console.error('autoBackupIfNeeded error:', e)
    return null
  }
}

// Eski zaxiralarni o'chirish (oxirgi 15 tasi qoladi)
async function rotateBackups() {
  try {
    const files = await readdir(BACKUP_DIR)
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort()
    const excess = jsonFiles.length - MAX_BACKUPS
    if (excess > 0) {
      const { unlink } = await import('fs/promises')
      for (let i = 0; i < excess; i++) {
        await unlink(path.join(BACKUP_DIR, jsonFiles[i]))
      }
    }
  } catch (e) {
    console.error('rotateBackups error:', e)
  }
}

// Zaxira faylidan ma'lumotlarni to'liq tiklash (BITTA tranzaksiyada)
// Avval mavjud zaxira olinadi (xavfsizlik uchun), keyin hammasi almashtiriladi
export async function restoreFromBackup(payload: {
  data?: {
    workers?: unknown[]
    sites?: unknown[]
    attendances?: unknown[]
    payments?: unknown[]
    siteTransactions?: unknown[]
    settings?: unknown[]
  }
}): Promise<{ workers: number; sites: number; attendances: number; payments: number; siteTransactions: number; settings: number }> {
  const d = payload?.data
  if (!d || !Array.isArray(d.workers) || !Array.isArray(d.sites) || !Array.isArray(d.attendances) || !Array.isArray(d.payments)) {
    throw new Error("Zaxira fayli formati noto'g'ri")
  }

  // Xavfsizlik: tiklashdan OLDIN hozirgi holatni zaxiralash
  await createServerBackup('before-restore')

  const result = await db.$transaction(async (tx) => {
    await tx.siteTransaction.deleteMany()
    await tx.payment.deleteMany()
    await tx.attendance.deleteMany()
    await tx.site.deleteMany()
    await tx.worker.deleteMany()
    await tx.setting.deleteMany()

    for (const w of d.workers ?? []) {
      const x = w as { id: string; fullName: string; phone?: string | null; position?: string | null; dailyRate?: number; active?: boolean; createdAt?: string; updatedAt?: string }
      if (!x?.id || !x.fullName) continue
      await tx.worker.create({
        data: {
          id: x.id,
          fullName: x.fullName,
          phone: x.phone ?? null,
          position: x.position ?? null,
          dailyRate: Number(x.dailyRate) || 0,
          active: x.active !== false,
          ...(x.createdAt ? { createdAt: new Date(x.createdAt) } : {}),
          ...(x.updatedAt ? { updatedAt: new Date(x.updatedAt) } : {}),
        },
      })
    }
    for (const s of d.sites ?? []) {
      const x = s as { id: string; name: string; address?: string | null; client?: string | null; active?: boolean; createdAt?: string; updatedAt?: string }
      if (!x?.id || !x.name) continue
      await tx.site.create({
        data: {
          id: x.id,
          name: x.name,
          address: x.address ?? null,
          client: x.client ?? null,
          active: x.active !== false,
          ...(x.createdAt ? { createdAt: new Date(x.createdAt) } : {}),
          ...(x.updatedAt ? { updatedAt: new Date(x.updatedAt) } : {}),
        },
      })
    }
    let attCount = 0
    for (const a of d.attendances ?? []) {
      const x = a as { id: string; workerId: string; siteId: string; date: string; status?: string; dayRate?: number | null; note?: string | null; createdAt?: string }
      if (!x?.id || !x.workerId || !x.siteId || !x.date) continue
      await tx.attendance.create({
        data: {
          id: x.id,
          workerId: x.workerId,
          siteId: x.siteId,
          date: x.date,
          status: x.status === 'ABSENT' ? 'ABSENT' : 'PRESENT',
          dayRate: x.dayRate ?? null,
          note: x.note ?? null,
          ...(x.createdAt ? { createdAt: new Date(x.createdAt) } : {}),
        },
      })
      attCount++
    }
    let payCount = 0
    for (const p of d.payments ?? []) {
      const x = p as { id: string; workerId: string; amount: number; date: string; note?: string | null; createdAt?: string }
      if (!x?.id || !x.workerId || isNaN(Number(x.amount)) || !x.date) continue
      await tx.payment.create({
        data: {
          id: x.id,
          workerId: x.workerId,
          amount: Number(x.amount),
          date: x.date,
          note: x.note ?? null,
          ...(x.createdAt ? { createdAt: new Date(x.createdAt) } : {}),
        },
      })
      payCount++
    }
    let txCount = 0
    for (const t of d.siteTransactions ?? []) {
      const x = t as { id: string; siteId: string; type?: string; amount: number; date: string; category?: string | null; note?: string | null; createdAt?: string }
      if (!x?.id || !x.siteId || isNaN(Number(x.amount)) || !x.date) continue
      await tx.siteTransaction.create({
        data: {
          id: x.id,
          siteId: x.siteId,
          type: x.type === 'ADVANCE' ? 'ADVANCE' : 'EXPENSE',
          amount: Number(x.amount),
          date: x.date,
          category: x.category ?? null,
          note: x.note ?? null,
          ...(x.createdAt ? { createdAt: new Date(x.createdAt) } : {}),
        },
      })
      txCount++
    }
    let setCount = 0
    for (const s of d.settings ?? []) {
      const x = s as { id: string; key: string; value: string }
      if (!x?.key) continue
      await tx.setting.create({
        data: { id: x.id, key: x.key, value: String(x.value ?? '') },
      })
      setCount++
    }

    return {
      workers: (d.workers ?? []).length,
      sites: (d.sites ?? []).length,
      attendances: attCount,
      payments: payCount,
      siteTransactions: txCount,
      settings: setCount,
    }
  }, { timeout: 120000, maxWait: 30000 })

  return result
}
