// Umumiy tiplar
export interface Worker {
  id: string
  fullName: string
  phone?: string | null
  position?: string | null
  dailyRate: number
  active: boolean
  createdAt: string
  updatedAt: string
  daysWorked?: number
  earned?: number
  paid?: number
  balance?: number
}

export interface Site {
  id: string
  name: string
  address?: string | null
  client?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  workerDays?: number
  totalCost?: number
  totalAdvance?: number
  totalExpense?: number
  balance?: number
}

export interface SiteTransaction {
  id: string
  siteId: string
  type: 'ADVANCE' | 'EXPENSE'
  amount: number
  date: string
  category?: string | null
  note?: string | null
  createdAt: string
  site: { id: string; name: string }
}

export interface FinanceData {
  transactions: SiteTransaction[]
  totalAdvance: number
  totalExpense: number
  bySite: { siteId: string; siteName: string; advance: number; expense: number }[]
  sites: { id: string; name: string }[]
}

export interface AttendanceRecord {
  id: string
  workerId: string
  siteId: string
  date: string
  status: 'PRESENT' | 'ABSENT'
  dayRate?: number | null
  note?: string | null
  createdAt: string
  worker: { id: string; fullName: string; position?: string | null; dailyRate: number }
  site: { id: string; name: string }
}

export interface Payment {
  id: string
  workerId: string
  amount: number
  date: string
  note?: string | null
  createdAt: string
  worker: { id: string; fullName: string; position?: string | null }
}

export interface DashboardData {
  workersActive: number
  sitesActive: number
  todayStats: {
    present: number
    absent: number
    cost: number
    records: AttendanceRecord[]
  }
  monthStats: { earned: number; paid: number; days: number; debt: number }
  monthFinance: { advance: number; expense: number }
  totalDebt: number
  trend: { date: string; count: number; cost: number }[]
  bySite: { name: string; cost: number }[]
  topDebtors: { id: string; fullName: string; position?: string | null; balance: number }[]
}

export interface ReportData {
  byWorker: {
    workerId: string
    workerName: string
    position?: string | null
    days: number
    absent: number
    earned: number
    paid: number
    balance: number
  }[]
  bySite: { siteId: string; siteName: string; workerDays: number; absent: number; cost: number }[]
  bySiteFinance: {
    siteId: string
    siteName: string
    advance: number
    expense: number
    txCount: number
    net: number
  }[]
  financeTotals: { advance: number; expense: number }
  byDate: { date: string; present: number; absent: number; cost: number }[]
  details: {
    date: string
    workerName: string
    position?: string | null
    siteName: string
    status: string
    rate: number
    amount: number
    note?: string | null
  }[]
  totals: { days: number; absent: number; earned: number; paid: number; balance: number }
}

export interface SettingsData {
  companyName: string
  lastBackup?: { filename: string; size: number; createdAt: string; reason: string } | null
}

export interface DataStats {
  workers: number
  sites: number
  attendances: number
  payments: number
  siteTransactions?: number
}
