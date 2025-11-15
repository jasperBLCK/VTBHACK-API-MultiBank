'use client'

import { ReactNode } from 'react'
import { SettingsProvider } from '@/contexts/SettingsContext'

export function Providers({ children }: { children: ReactNode }) {
  // ErrorBoundary убран, так как Next.js 14 имеет встроенную обработку ошибок через error.tsx и global-error.tsx
  return (
    <SettingsProvider>
      {children}
    </SettingsProvider>
  )
}

