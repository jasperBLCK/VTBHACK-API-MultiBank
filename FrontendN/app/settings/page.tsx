'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import BankConnectionModal from '@/components/BankConnectionModal'
import { useSettings } from '@/contexts/SettingsContext'
import { CreditCard, Link as LinkIcon, Bell, Shield, Palette, Globe, RefreshCw, LogOut } from 'lucide-react'
import { Notification } from '@/types'

const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36)

interface BankConnection {
  id: string
  bankId: string
  bankName: string
  isActive: boolean
  lastSyncedAt: string
  createdAt: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { settings, updateTheme, updateLanguage, updateNotifications, updateAutoSync, updateSyncInterval } = useSettings()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [bankModalOpen, setBankModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [connectedBanks, setConnectedBanks] = useState<BankConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBankConnections()
    loadNotifications()
  }, [])

  const loadBankConnections = async () => {
    try {
      const res = await fetch('/api/bank-connections')
      if (res.ok) {
        const data = await res.json()
        setConnectedBanks(data)
      } else {
        console.error('Ошибка загрузки подключений банков')
      }
    } catch (error) {
      console.error('Ошибка загрузки подключений банков:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        const notificationsWithDates = data.map((n: any) => ({
          ...n,
          timestamp: typeof n.timestamp === 'string' ? new Date(n.timestamp) : n.timestamp,
        }))
        setNotifications(notificationsWithDates)
      }
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error)
    }
  }

  const handleOpenBankModal = useCallback(() => {
    setBankModalOpen(true)
  }, [])

  const handleCloseBankModal = useCallback(() => {
    setBankModalOpen(false)
  }, [])

  const addNotification = async (type: Notification['type'], title: string, message: string) => {
    const notification: Notification = {
      id: generateId(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
    }
    setNotifications(prev => [notification, ...prev])
  }

  const handleConnectBank = useCallback(async (bankId: string) => {
    const bankNameMap: Record<string, string> = {
      'vtb': 'ВТБ',
      'sberbank': 'Сбербанк',
      'alfabank': 'Альфа-Банк',
      'tinkoff': 'Тинькофф',
      'raiffeisen': 'Райффайзен',
    }
    const bankName = bankNameMap[bankId] || bankId
    
    // Проверяем, не подключен ли уже этот банк
    if (connectedBanks.find(b => b.bankId === bankId && b.isActive)) {
      addNotification('info', 'Банк уже подключен', `${bankName} уже подключен`)
      return
    }

    try {
      const res = await fetch('/api/bank-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, bankName }),
      })

      if (res.ok) {
        const newConnection = await res.json()
        // Проверяем, не добавлен ли уже этот банк
        if (!connectedBanks.find(b => b.id === newConnection.id)) {
          setConnectedBanks([...connectedBanks, newConnection])
        } else {
          // Если банк уже был в списке, обновляем его статус
          setConnectedBanks(connectedBanks.map(b => 
            b.id === newConnection.id ? newConnection : b
          ))
        }
        addNotification('success', 'Банк подключен', `${bankName} успешно подключен. Счет создан автоматически.`)
        
        // Создаем уведомление на сервере
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'success',
            title: 'Банк подключен',
            message: `${bankName} успешно подключен. Счет создан автоматически.`,
          }),
        })
        
        // Обновляем список счетов на других страницах
        window.dispatchEvent(new CustomEvent('bankConnected'))
        
        // Закрываем модальное окно
        handleCloseBankModal()
      } else {
        const errorData = await res.json()
        const errorMessage = errorData.error || 'Не удалось подключить банк'
        addNotification('error', 'Ошибка подключения', errorMessage)
        
        // Если банк уже подключен, это не критическая ошибка
        if (res.status === 400 && errorMessage.includes('уже подключен')) {
          // Перезагружаем список подключений
          await loadBankConnections()
        }
      }
    } catch (error) {
      console.error('Ошибка подключения банка:', error)
      addNotification('error', 'Ошибка подключения', 'Не удалось подключить банк')
    }
  }, [connectedBanks, addNotification, handleCloseBankModal])

  const handleDisconnectBank = async (connectionId: string) => {
    const bank = connectedBanks.find(b => b.id === connectionId)
    if (!bank) return

    try {
      const res = await fetch(`/api/bank-connections?id=${connectionId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setConnectedBanks(connectedBanks.filter(b => b.id !== connectionId))
        addNotification('info', 'Банк отключен', `${bank.bankName} отключен. Счета удалены.`)
        
        // Создаем уведомление на сервере
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'info',
            title: 'Банк отключен',
            message: `${bank.bankName} отключен. Счета удалены.`,
          }),
        })
        
        // Обновляем список счетов на других страницах
        window.dispatchEvent(new CustomEvent('bankDisconnected'))
      } else {
        const error = await res.json()
        addNotification('error', 'Ошибка отключения', error.error || 'Не удалось отключить банк')
      }
    } catch (error) {
      console.error('Ошибка отключения банка:', error)
      addNotification('error', 'Ошибка отключения', 'Не удалось отключить банк')
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, markAsRead: true }),
      })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Ошибка отметки уведомления как прочитанного:', error)
    }
  }

  const handleRemoveNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('Ошибка удаления уведомления:', error)
    }
  }

  const handleLogout = () => {
    // Очищаем токен и данные пользователя
    localStorage.removeItem('access_token')
    localStorage.removeItem('client_id')
    // Перенаправляем на страницу входа
    router.push('/login')
  }

  const handleMenuClick = useCallback(() => {
    setMobileMenuOpen(true)
  }, [])

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onRemoveNotification={handleRemoveNotification}
        onMenuClick={handleMenuClick}
      />
      <div className="flex relative flex-1">
        <Sidebar
          isMobileOpen={mobileMenuOpen}
          onMobileClose={handleMobileClose}
        />
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Настройки</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Управление настройками приложения</p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* Настройки внешнего вида */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Palette className="h-6 w-6 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Внешний вид</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Тема</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Выберите светлую или тёмную тему</p>
                  </div>
                  <select
                    value={settings.theme}
                    onChange={(e) => updateTheme(e.target.value as 'light' | 'dark' | 'system')}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="light">Светлая</option>
                    <option value="dark">Тёмная</option>
                    <option value="system">Системная</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Язык</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Язык интерфейса</p>
                  </div>
                  <select
                    value={settings.language}
                    onChange={(e) => updateLanguage(e.target.value as 'ru' | 'en')}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Настройки синхронизации */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <RefreshCw className="h-6 w-6 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Синхронизация</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Автоматическая синхронизация</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Автоматическое обновление данных</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.autoSync}
                      onChange={(e) => updateAutoSync(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                {settings.autoSync && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Интервал синхронизации</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Как часто обновлять данные</p>
                    </div>
                    <select
                      value={settings.syncInterval}
                      onChange={(e) => updateSyncInterval(Number(e.target.value))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="15">15 минут</option>
                      <option value="30">30 минут</option>
                      <option value="60">1 час</option>
                      <option value="120">2 часа</option>
                      <option value="240">4 часа</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <CreditCard className="h-6 w-6 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Подключенные банки</h3>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">Загрузка подключений...</p>
                  </div>
                ) : connectedBanks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">Нет подключенных банков</p>
                  </div>
                ) : (
                  connectedBanks.map((bank) => {
                    const lastSyncDate = new Date(bank.lastSyncedAt)
                    const minutesAgo = Math.floor((Date.now() - lastSyncDate.getTime()) / 60000)
                    const handleDisconnect = () => handleDisconnectBank(bank.id)
                    return (
                      <div key={bank.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-600 dark:text-primary-400 font-bold">{bank.bankName[0]}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{bank.bankName}</p>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              Подключен • Синхронизировано {minutesAgo < 1 ? 'только что' : `${minutesAgo} мин назад`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleDisconnect}
                          className="px-3 sm:px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-sm sm:text-base self-start sm:self-auto"
                        >
                          Отключить
                        </button>
                      </div>
                    )
                  })
                )}
                <button
                  onClick={handleOpenBankModal}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-primary-500 dark:hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition"
                >
                  <LinkIcon className="h-5 w-5" />
                  <span>Подключить новый банк</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Bell className="h-6 w-6 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Уведомления</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Push-уведомления</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Получать уведомления о транзакциях</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.notifications.push}
                      onChange={(e) => updateNotifications({ push: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Email-уведомления</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Еженедельный отчет на email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.notifications.email}
                      onChange={(e) => updateNotifications({ email: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="h-6 w-6 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Безопасность</h3>
              </div>
              <div className="space-y-4">
                <button className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition">
                  <p className="font-medium text-gray-900 dark:text-white">Изменить пароль</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Обновить пароль для входа</p>
                </button>
                <button className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition">
                  <p className="font-medium text-gray-900 dark:text-white">Двухфакторная аутентификация</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Дополнительная защита аккаунта</p>
                </button>
              </div>
            </div>

            {/* Выход из аккаунта */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <LogOut className="h-6 w-6 text-red-600 dark:text-red-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Выход</h3>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Выйти из аккаунта и вернуться на страницу входа
                </p>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Выйти из аккаунта</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <BankConnectionModal
        isOpen={bankModalOpen}
        onClose={handleCloseBankModal}
        onConnect={handleConnectBank}
      />
    </div>
  )
}

