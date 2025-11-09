'use client'

import { useState, useEffect, useRef } from 'react'
import { BankAccount, Notification } from '@/types'
import AccountCard from '@/components/AccountCard'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import TransferModal from '@/components/TransferModal'
import BankConnectionModal from '@/components/BankConnectionModal'
import MultibankAccounts from '@/components/MultibankAccounts'
import { Plus } from 'lucide-react'

const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36)

// Статический текст для предотвращения ошибок гидратации
const PAGE_DESCRIPTION = 'Управление вашими счетами'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [multibankAccounts, setMultibankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [multibankLoading, setMultibankLoading] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [bankModalOpen, setBankModalOpen] = useState(false)
  const [selectedAccountForTransfer, setSelectedAccountForTransfer] = useState<BankAccount | undefined>()
  const [clientId, setClientId] = useState<string | null>(null)
  const multibankLoadRefLocal = useRef<(() => void) | null>(null)

  useEffect(() => {
    loadAccounts()
    
    // Слушаем события подключения/отключения банка для обновления счетов
    const handleBankConnected = () => {
      loadAccounts()
    }
    
    const handleBankDisconnected = () => {
      loadAccounts()
    }
    
    window.addEventListener('bankConnected', handleBankConnected)
    window.addEventListener('bankDisconnected', handleBankDisconnected)
    
    return () => {
      window.removeEventListener('bankConnected', handleBankConnected)
      window.removeEventListener('bankDisconnected', handleBankDisconnected)
    }
  }, [])

  // Загружаем client_id
  useEffect(() => {
    const storedClientId = localStorage.getItem('client_id')
    if (storedClientId) {
      setClientId(storedClientId)
    } else {
      // Пытаемся получить из API
      const loadMe = async () => {
        try {
          const token = localStorage.getItem('access_token')
          if (!token) return
          
          const res = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.client_id) {
              localStorage.setItem('client_id', data.client_id)
              setClientId(data.client_id)
            }
          }
        } catch (error) {
          console.error('Ошибка загрузки информации о пользователе:', error)
        }
      }
      loadMe()
    }
  }, [])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/accounts', { headers })
      if (res.ok) {
        const accountsData = await res.json()
        
        // Загружаем карты для каждого счета (если есть client_id)
        const clientId = localStorage.getItem('client_id')
        if (clientId) {
          const accountsWithCards = await Promise.all(
            accountsData.map(async (account: BankAccount) => {
              try {
                // Пытаемся загрузить карты через multibank API
                // Для основных счетов карты могут быть доступны через основной API
                // Пока оставляем пустым, карты будут загружаться из multibank
                return account
              } catch (error) {
                console.warn(`Не удалось загрузить карты для счета ${account.id}:`, error)
                return account
              }
            })
          )
          setAccounts(accountsWithCards)
        } else {
          setAccounts(accountsData)
        }
      } else {
        console.error('Ошибка загрузки счетов')
        setAccounts([])
      }
    } catch (error) {
      console.error('Ошибка загрузки счетов:', error)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  const addNotification = (type: Notification['type'], title: string, message: string) => {
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

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const handleRemoveNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleTransfer = async (fromAccountId: string, toAccountId: string, amount: number, description: string) => {
    try {
      const token = localStorage.getItem('access_token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount,
          description,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Ошибка выполнения перевода')
      }

      const result = await res.json()

      // Обновляем счета после перевода
      await loadAccounts()

      const fromAccount = accounts.find(a => a.id === fromAccountId)
      const toAccount = accounts.find(a => a.id === toAccountId)
      const commission = fromAccount && toAccount && fromAccount.bankName !== toAccount.bankName
        ? amount * 0.01
        : 0

      const notificationMessage = commission > 0
        ? `Переведено ${amount.toLocaleString('ru-RU')} ₽ (комиссия ${commission.toLocaleString('ru-RU')} ₽)`
        : `Переведено ${amount.toLocaleString('ru-RU')} ₽`
      addNotification('success', 'Перевод выполнен', notificationMessage)
    } catch (error: any) {
      console.error('Ошибка выполнения перевода:', error)
      addNotification('error', 'Ошибка перевода', error?.message || 'Не удалось выполнить перевод')
      throw error
    }
  }

  const handleOpenTransfer = (account?: BankAccount) => {
    setSelectedAccountForTransfer(account)
    setTransferModalOpen(true)
  }

  const handleConnectBank = (bankId: string) => {
    const bank = bankId === 'vtb' ? 'ВТБ' : 
                 bankId === 'sberbank' ? 'Сбербанк' :
                 bankId === 'alfabank' ? 'Альфа-Банк' : bankId
    addNotification('success', 'Банк подключен', `${bank} успешно подключен`)
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onRemoveNotification={handleRemoveNotification}
        onMenuClick={() => setMobileMenuOpen(true)}
      />
      <div className="flex relative flex-1">
        <Sidebar
          isMobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Счета</h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                {PAGE_DESCRIPTION}
              </p>
            </div>
            <button
              onClick={() => setBankModalOpen(true)}
              className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm sm:text-base"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Подключить банк</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Нет подключенных счетов</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Подключите свой первый банк, чтобы начать управлять финансами
                  </p>
                  <button
                    onClick={() => setBankModalOpen(true)}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Подключить банк
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                {accounts.map((account) => (
                  <AccountCard key={account.id} account={account} onTransfer={handleOpenTransfer} />
                ))}
                {multibankAccounts.map((account) => (
                  <AccountCard key={account.id} account={account} onTransfer={handleOpenTransfer} />
                ))}
              </div>
              
              {clientId && (
                <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
                  <MultibankAccounts
                    currentClientId={clientId}
                    onAccountsLoaded={(multibankAccs) => {
                      setMultibankAccounts(multibankAccs)
                      setMultibankLoading(false)
                    }}
                    onLoadRef={(loadFn) => {
                      // Сохраняем функцию загрузки для вызова при необходимости,
                      // но не вызываем её автоматически чтобы избежать дублирующих вызовов
                      if (loadFn) {
                        multibankLoadRefLocal.current = loadFn
                      }
                    }}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <TransferModal
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false)
          setSelectedAccountForTransfer(undefined)
        }}
        accounts={[...accounts, ...multibankAccounts]}
        fromAccount={selectedAccountForTransfer}
        onTransfer={handleTransfer}
      />

      <BankConnectionModal
        isOpen={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        onConnect={handleConnectBank}
      />
    </div>
  )
}

