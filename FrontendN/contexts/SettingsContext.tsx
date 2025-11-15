'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'
type Language = 'ru' | 'en'

interface Settings {
  theme: Theme
  language: Language
  notifications: {
    push: boolean
    email: boolean
  }
  autoSync: boolean
  syncInterval: number // в минутах
}

interface SettingsContextType {
  settings: Settings
  updateTheme: (theme: Theme) => void
  updateLanguage: (language: Language) => void
  updateNotifications: (notifications: Partial<Settings['notifications']>) => void
  updateAutoSync: (autoSync: boolean) => void
  updateSyncInterval: (interval: number) => void
}

const defaultSettings: Settings = {
  theme: 'system',
  language: 'ru',
  notifications: {
    push: true,
    email: false,
  },
  autoSync: true,
  syncInterval: 60,
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [mounted, setMounted] = useState(false)

  // Применение темы сразу при загрузке (до монтирования) для предотвращения белой вспышки
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Загружаем настройки из localStorage синхронно
    const saved = localStorage.getItem('multibank-settings')
    let initialSettings = defaultSettings
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        initialSettings = { ...defaultSettings, ...parsed }
        setSettings(initialSettings)
      } catch (e) {
        console.error('Ошибка загрузки настроек:', e)
      }
    }

    // Применяем тему сразу, чтобы избежать белой вспышки
    const root = document.documentElement
    const effectiveTheme = initialSettings.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : initialSettings.theme

    if (effectiveTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    setMounted(true)
  }, [])

  // Применение темы при изменении настроек
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return

    const root = document.documentElement
    const effectiveTheme = settings.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : settings.theme

    if (effectiveTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [settings.theme, mounted])

  // Сохранение настроек в localStorage
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      localStorage.setItem('multibank-settings', JSON.stringify(settings))
      
      // Применяем язык к HTML элементу
      document.documentElement.lang = settings.language
    }
  }, [settings, mounted])
  
  // Применение языка при загрузке
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const saved = localStorage.getItem('multibank-settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.language) {
          document.documentElement.lang = parsed.language
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }
  }, [])

  const updateTheme = (theme: Theme) => {
    setSettings(prev => ({ ...prev, theme }))
  }

  const updateLanguage = (language: Language) => {
    setSettings(prev => ({ ...prev, language }))
  }

  const updateNotifications = (notifications: Partial<Settings['notifications']>) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, ...notifications },
    }))
  }

  const updateAutoSync = (autoSync: boolean) => {
    setSettings(prev => ({ ...prev, autoSync }))
  }

  const updateSyncInterval = (syncInterval: number) => {
    setSettings(prev => ({ ...prev, syncInterval }))
  }

  // Всегда предоставляем контекст, даже до загрузки настроек
  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateTheme,
        updateLanguage,
        updateNotifications,
        updateAutoSync,
        updateSyncInterval,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

