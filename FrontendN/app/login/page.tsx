'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bankName, setBankName] = useState('FinScope')
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    // Проверяем доступность backend
    const checkBackend = async () => {
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        
        if (data.status === 'ok') {
          setBackendStatus('ok')
          if (data.backend?.bank) {
            setBankName(data.backend.bank)
          }
        } else {
          setBackendStatus('error')
          setError(`Backend недоступен: ${data.message || 'Неизвестная ошибка'}`)
        }
      } catch (error) {
        setBackendStatus('error')
        setError('Не удалось подключиться к backend. Убедитесь что backend запущен на порту 8001.')
      }
    }
    
    checkBackend()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Если ошибка подключения к backend, показываем более понятное сообщение
        if (response.status === 503 && errorData.hint) {
          throw new Error(`${errorData.error}\n\n${errorData.hint}`)
        }
        throw new Error(errorData.error || 'Неверные учетные данные')
      }

      const data = await response.json()

      // Сохраняем токен
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('client_id', data.client_id)
      }

      // Переходим на главную страницу
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  const quickLogins = [
    { username: 'team251-1', password: 'password', label: 'Team 251-1', gradient: 'from-blue-500 to-cyan-500' },
    { username: 'team251-2', password: 'password', label: 'Team 251-2', gradient: 'from-purple-500 to-pink-500' },
    { username: 'team251-3', password: 'password', label: 'Team 251-3', gradient: 'from-green-500 to-emerald-500' },
  ]

  const handleQuickLogin = (username: string, password: string) => {
    setUsername(username)
    setPassword(password)
    setTimeout(() => {
      const form = document.getElementById('loginForm') as HTMLFormElement
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      }
    }, 100)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/30 mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">FinScope</h1>
          <p className="text-gray-600 dark:text-gray-400">Мультибанковская платформа</p>
          {backendStatus === 'checking' && (
            <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-pulse"></div>
              Проверка подключения...
            </div>
          )}
          {backendStatus === 'error' && (
            <div className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              ⚠️ Backend недоступен
            </div>
          )}
        </div>

        {/* Login card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <form id="loginForm" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ID клиента
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="team251-1"
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Вход...
                </span>
              ) : (
                '🔐 Войти'
              )}
            </button>
          </form>

          {/* Quick login buttons */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center">Быстрый вход для тестирования:</p>
            <div className="grid grid-cols-3 gap-2">
              {quickLogins.map((login, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleQuickLogin(login.username, login.password)}
                  className={`bg-gradient-to-br ${login.gradient} text-white text-xs py-2 px-3 rounded-lg hover:scale-105 active:scale-95 transition-all font-medium shadow-lg hover:shadow-xl`}
                >
                  {login.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600 dark:text-gray-400">
          <p>Защищено Open Banking API</p>
          <p className="mt-1">© 2025 FinScope. Все права защищены.</p>
        </div>
      </div>
    </div>
  )
}
