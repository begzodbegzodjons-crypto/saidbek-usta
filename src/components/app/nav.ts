export type TabKey =
  | 'dashboard'
  | 'attendance'
  | 'workers'
  | 'sites'
  | 'payments'
  | 'finance'
  | 'reports'
  | 'settings'

export interface NavItem {
  key: TabKey
  label: string
  shortLabel: string
  group: string
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Boshqaruv paneli', shortLabel: 'Bosh', group: 'Asosiy' },
  { key: 'attendance', label: 'Davomat', shortLabel: 'Davomat', group: 'Asosiy' },
  { key: 'workers', label: 'Ishchilar', shortLabel: 'Ishchilar', group: 'Boshqaruv' },
  { key: 'sites', label: 'Obyektlar', shortLabel: 'Obyekt', group: 'Boshqaruv' },
  { key: 'payments', label: "To'lovlar", shortLabel: "To'lov", group: 'Moliya' },
  { key: 'finance', label: 'Avans va xarajatlar', shortLabel: 'Moliya', group: 'Moliya' },
  { key: 'reports', label: 'Hisobotlar', shortLabel: 'Hisobot', group: 'Moliya' },
  { key: 'settings', label: 'Sozlamalar', shortLabel: 'Sozlama', group: 'Tizim' },
]

// Sidebar guruhlari tartibi
export const NAV_GROUPS = ['Asosiy', 'Boshqaruv', 'Moliya', 'Tizim'] as const

// Mobil pastki menyuda ko'rinadigan bo'limlar (Sozlamalar — header'dagi tugma orqali)
export const BOTTOM_NAV_KEYS: TabKey[] = [
  'dashboard',
  'attendance',
  'workers',
  'sites',
  'payments',
  'finance',
  'reports',
]
