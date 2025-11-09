'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bankName, setBankName] = useState('Bank')
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

  const handleRandomLogin = () => {
    const testClients = [
      { username: 'team251-1', password: 'iOin4bZP3rRl44r7TNy5ZigMUjcQIem1' },
      { username: 'team200-1', password: 'password' },
      { username: 'team200-2', password: 'password' },
      { username: 'demo-client-001', password: 'password' },
    ]
    const randomClient = testClients[Math.floor(Math.random() * testClients.length)]
    setUsername(randomClient.username)
    setPassword(randomClient.password)
    
    // Автоматически отправляем форму через небольшую задержку
    setTimeout(() => {
      const form = document.getElementById('loginForm') as HTMLFormElement
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      }
    }, 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-sm text-purple-600 font-medium mb-2">{bankName}</div>
          <h1 className="text-2xl font-bold text-gray-800">Вход в личный кабинет</h1>
          {backendStatus === 'checking' && (
            <div className="mt-2 text-xs text-gray-500">Проверка подключения к backend...</div>
          )}
          {backendStatus === 'error' && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              ⚠ Backend недоступен. Убедитесь что backend запущен: <code className="bg-red-100 px-1 rounded">python run.py</code>
            </div>
          )}
        </div>

        <form id="loginForm" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              ID клиента
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="team200-1"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>

          <button
            type="button"
            onClick={handleRandomLogin}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            🎲 Войти как случайный клиент
          </button>

          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
            <div className="font-semibold mb-2">Тестовые клиенты:</div>
            <div className="space-y-1">
              <div><strong>Команда team251:</strong> team251-1, team251-2, team251-3...</div>
              <div><strong>Команда team200:</strong> team200-1, team200-2, team200-3...</div>
              <div><strong>Demo клиенты:</strong> demo-client-001, demo-client-002, demo-client-003</div>
              <div className="mt-2">
                <div>Пароль для team251: <code className="bg-gray-100 px-1 rounded">iOin4bZP3rRl44r7TNy5ZigMUjcQIem1</code></div>
                <div>Пароль для остальных: <code className="bg-gray-100 px-1 rounded">password</code></div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

