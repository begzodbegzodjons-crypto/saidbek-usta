'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Ma'lumot yuklashda xatolik banneri — "bo'sh ro'yxat" bilan adashtirmaslik uchun
export default function LoadError({
  message,
  onRetry,
}: {
  message?: string | null
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-7 text-center">
      <AlertCircle className="h-7 w-7 text-destructive" />
      <p className="max-w-sm text-sm font-medium text-destructive">
        {message || "Ma'lumotlarni yuklashda xatolik"}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Qayta urinish
        </Button>
      )}
    </div>
  )
}
