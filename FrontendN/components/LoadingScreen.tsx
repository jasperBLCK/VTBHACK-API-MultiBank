'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false
  
  const htmlElement = document.documentElement
  
  // ПЕРВЫЙ ПРИОРИТЕТ: Проверяем data-атрибут, установленный скриптом
  const dataTheme = htmlElement.getAttribute('data-theme')
  if (dataTheme === 'dark') return true
  if (dataTheme === 'light') return false
  
  // ВТОРОЙ ПРИОРИТЕТ: Проверяем класс dark на html элементе
  // Скрипт в layout.tsx должен был применить его ДО рендеринга
  if (htmlElement.classList.contains('dark')) {
    return true
  }
  
  // ТРЕТИЙ ПРИОРИТЕТ: Если скрипт не сработал, проверяем localStorage напрямую
  try {
    const saved = localStorage.getItem('multibank-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      const theme = parsed.theme || 'system'
      
      let isDark = false
      if (theme === 'dark') {
        isDark = true
      } else if (theme === 'light') {
        isDark = false
      } else {
        // system - проверяем системную тему
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      
      // Применяем тему синхронно
      if (isDark) {
        htmlElement.classList.add('dark')
        htmlElement.setAttribute('data-theme', 'dark')
      } else {
        htmlElement.classList.remove('dark')
        htmlElement.setAttribute('data-theme', 'light')
      }
      
      return isDark
    }
  } catch (e) {
    // Игнорируем ошибки
  }
  
  // ЧЕТВЕРТЫЙ ПРИОРИТЕТ: По умолчанию проверяем системную тему
  const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isSystemDark) {
    htmlElement.classList.add('dark')
    htmlElement.setAttribute('data-theme', 'dark')
  } else {
    htmlElement.classList.remove('dark')
    htmlElement.setAttribute('data-theme', 'light')
  }
  return isSystemDark
}

export default function LoadingScreen() {
  const [isDark, setIsDark] = useState(getInitialTheme)

  useEffect(() => {
    // Синхронизируем с реальным состоянием темы на странице
    const updateTheme = () => {
      const hasDarkClass = document.documentElement.classList.contains('dark')
      setIsDark(hasDarkClass)
    }
    
    // Проверяем сразу
    updateTheme()
    
    // Слушаем изменения темы
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    
    // Также слушаем изменения системной темы
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      // Проверяем, не установлена ли явная тема
      try {
        const saved = localStorage.getItem('multibank-settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.theme !== 'system') {
            return // Игнорируем изменения системной темы, если тема задана явно
          }
        }
      } catch (e) {
        // Игнорируем ошибки
      }
      updateTheme()
    }
    
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    
    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [])

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-200`}>
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Loader2 className={`h-12 w-12 ${isDark ? 'text-primary-400' : 'text-primary-600'} animate-spin`} />
          <div className={`absolute inset-0 ${isDark ? 'bg-primary-400/20' : 'bg-primary-600/20'} blur-xl rounded-full`}></div>
        </div>
        <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Загрузка...
        </p>
      </div>
    </div>
  )
}
