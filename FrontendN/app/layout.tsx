import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import Script from 'next/script'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Мультибанк - Единый финансовый сервис',
  description: 'Управляйте финансами из разных банков в одном интерфейсе',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// Скрипт для предотвращения белой вспышки при загрузке темной темы
// Выполняется ДО рендеринга страницы
const themeScript = `
  (function() {
    try {
      const saved = localStorage.getItem('multibank-settings');
      let theme = 'system';
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          theme = parsed.theme || 'system';
        } catch (e) {
          // Если не удалось распарсить, используем system
        }
      }
      
      let effectiveTheme = theme;
      if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      const html = document.documentElement;
      if (effectiveTheme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      
      // Устанавливаем data-атрибут для дополнительной проверки
      html.setAttribute('data-theme', effectiveTheme);
    } catch (e) {
      // В случае ошибки оставляем тему по умолчанию (светлую)
    }
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

