// Summani so'm formatida chiqarish: 1 234 567
export function formatMoney(n: number | null | undefined): string {
  const value = Math.round(n ?? 0)
  const sign = value < 0 ? '-' : ''
  return sign + Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Bugungi sana YYYY-MM-DD (lokal vaqt bo'yicha)
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Shu oyning birinchi kuni
export function monthStartStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// YYYY-MM-DD -> DD.MM.YYYY
export function formatDate(date: string | undefined | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return date ?? ''
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

// ISO vaqt -> DD.MM.YYYY HH:MM
export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// YYYY-MM-DD -> oylar nomi bilan (12 Sentabr, 2025)
const MONTHS_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]
export function formatDateUz(date: string | undefined | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return date ?? ''
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${Number(d)} ${MONTHS_UZ[Number(m) - 1]}, ${y}`
}

// Hafta kuni nomi
export function weekdayUz(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return ''
  const dt = new Date(date.slice(0, 10) + 'T12:00:00')
  const days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
  return days[dt.getDay()]
}
