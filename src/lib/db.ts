import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

// SQLite'ni ko'p foydalanuvchi (10+ qurilma) uchun tayyorlash:
// 1) WAL rejimi — o'qish va yozish bir vaqtda ishlaydi (baza faylida doimiy saqlanadi)
// 2) busy_timeout — yozuv band bo'lsa 10 soniyaga navbat kutadi, xato bermaydi
// 3) connection_limit=1 (.env) — barcha so'rovlar bitta kanal orqali navbat bilan,
//    shu sababli hech qachon ma'lumot yo'qolmaydi yoki ustma-ust yozilmaydi
// Eslatma: PRAGMA natija qaytaradi — $queryRawUnsafe ishlatiladi
async function initSqlite() {
  try {
    await db.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await db.$queryRawUnsafe('PRAGMA busy_timeout=10000;')
    await db.$queryRawUnsafe('PRAGMA foreign_keys=ON;')
    await db.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
  } catch (e) {
    console.error('SQLite init pragma error:', e)
  }
}
if (!globalForPrisma.prisma) {
  initSqlite()
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
