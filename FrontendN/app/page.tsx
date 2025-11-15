'use client'


import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'
import AccountCard from '@/components/AccountCard'
import QuickStats from '@/components/QuickStats'
import TransactionList from '@/components/TransactionList'
import MultibankAccounts from '@/components/MultibankAccounts'
import TransferModal from '@/components/TransferModal'
import AccountDetailsModal from '@/components/AccountDetailsModal'
import CreateAccountModal from '@/components/CreateAccountModal'
import AIChat from '@/components/AIChat'
import { BankAccount, Notification } from '@/types'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus } from 'lucide-react'

const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36)

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export default function Home() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [multibankAccounts, setMultibankAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [selectedFromAccount, setSelectedFromAccount] = useState<BankAccount | undefined>(undefined)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<BankAccount | null>(null)
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }
    setIsAuthenticated(true)
    if (typeof window !== 'undefined') {
      const storedClientId = localStorage.getItem('client_id')
      if (storedClientId) {
        setClientId(storedClientId)
      }
    }
    loadData()
  }, [router])

  const loadData = async () => {
    setLoading(true)
    try {
      const [accountsRes, transactionsRes, notificationsRes] = await Promise.allSettled([
        fetch('/api/accounts', { headers: getAuthHeaders() }),
        fetch('/api/transactions', { headers: getAuthHeaders() }),
        fetch('/api/notifications', { headers: getAuthHeaders() }),
      ])

      if (accountsRes.status === 'fulfilled' && accountsRes.value.ok) {
        setAccounts(await accountsRes.value.json())
      } else if (accountsRes.status === 'fulfilled' && accountsRes.value.status === 401) {
        router.push('/login')
        return
      }

      if (transactionsRes.status === 'fulfilled' && transactionsRes.value.ok) {
        setTransactions(await transactionsRes.value.json())
      }

      if (notificationsRes.status === 'fulfilled' && notificationsRes.value.ok) {
        setNotifications(await notificationsRes.value.json())
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async (fromAccountId: string, toAccountId: string, amount: number, description: string) => {
    try {
      const response = await fetch('/api/payments/transfer/internal', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: amount.toString(),
          description: description || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Ошибка при переводе')
      }

      // Перезагружаем данные после успешного перевода
      await loadData()
      setTransferModalOpen(false)
    } catch (error) {
      console.error('Ошибка перевода:', error)
      throw error
    }
  }

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const allAccounts = [...accounts, ...multibankAccounts]
  const totalBalance = allAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const income = transactions.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + t.amount, 0)
  const expenses = transactions.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(t.amount), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header
        notifications={notifications}
        onMarkAsRead={() => {}}
        onRemoveNotification={() => {}}
        onMenuClick={() => setMobileMenuOpen(true)}
        onCreateAccount={() => setCreateAccountModalOpen(true)}
      />

      <div className="flex relative flex-1">
        <Sidebar isMobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

        <main className="flex-1 min-w-0 p-6">
          {/* Hero / summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Обзор</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Краткая сводка по счетам и движениям</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Итоговый баланс</div>
                  <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(totalBalance)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => loadData()} className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm">Обновить</button>
                  <button onClick={() => setMobileMenuOpen(true)} className="px-3 py-2 bg-primary-600 text-white rounded-md text-sm">Действия</button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                <div className="text-xs text-gray-500">Баланс</div>
                <div className="text-lg font-medium">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(totalBalance)}</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                <div className="text-xs text-gray-500">Доходы (период)</div>
                <div className="text-lg font-medium text-green-600">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(income)}</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                <div className="text-xs text-gray-500">Расходы (период)</div>
                <div className="text-lg font-medium text-red-600">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(expenses)}</div>
              </div>
            </div>
          </div>

          {/* Accounts section */}
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Мои счета</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Управление вашими счетами</p>
            </div>
            {allAccounts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-6xl mb-4">💳</div>
                <p className="text-gray-500 dark:text-gray-400 mb-2">У вас пока нет счетов</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Создайте первый счет для начала работы</p>
                <button 
                  onClick={() => setCreateAccountModalOpen(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all font-medium shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98]"
                >
                  ✨ Создать счет
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allAccounts.map((account) => (
                  <AccountCard 
                    key={account.id} 
                    account={account} 
                    onTransfer={() => {
                      setSelectedFromAccount(account)
                      setTransferModalOpen(true)
                    }}
                    onDelete={(accountId) => {
                      // Удаляем счет из списка после успешного удаления с БД
                      const isMultibank = multibankAccounts.find(a => a.id === accountId)
                      if (isMultibank) {
                        setMultibankAccounts(multibankAccounts.filter(a => a.id !== accountId))
                      } else {
                        setAccounts(accounts.filter(a => a.id !== accountId))
                      }
                    }}
                    onDetails={(account) => {
                      setSelectedAccountForDetails(account)
                      setDetailsModalOpen(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Analytics section */}
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Аналитика</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Анализ ваших движений</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Доходы и расходы по месяцам</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { month: 'Сен', income: 30000, expenses: 15000 },
                    { month: 'Окт', income: 35000, expenses: 18000 },
                    { month: 'Ноя', income: 28000, expenses: 12000 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" name="Доходы" />
                    <Bar dataKey="expenses" fill="#ef4444" name="Расходы" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Расходы по категориям</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={[
                      { name: 'Еда', value: 4000 },
                      { name: 'Транспорт', value: 3000 },
                      { name: 'Развлечения', value: 2000 },
                      { name: 'Другое', value: 3500 },
                    ]} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value">
                      <Cell fill="#0ea5e9" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-6">
              <QuickStats transactions={transactions} />
            </div>
          </div>

          {/* Transactions section */}
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Последние операции</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">История всех транзакций</p>
            </div>
            <TransactionList transactions={transactions.slice(0, 10)} />
          </div>

          {/* FinScope section */}
          <div className="mt-8 pb-12">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">FinScope</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Счета из других банков</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              {clientId ? (
                <>
                  {/* MultibankAccounts component to load accounts */}
                  <div className="mb-6">
                    <MultibankAccounts
                      currentClientId={clientId}
                      onAccountsLoaded={(accs) => setMultibankAccounts(accs)}
                      onLoadRef={() => {}}
                    />
                  </div>

                  {/* Display loaded multibank accounts in a grid */}
                  {multibankAccounts && multibankAccounts.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Загруженные счета</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {multibankAccounts.map((account) => (
                          <div key={account.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{(account as any).bankCode || 'Другой банк'}</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(account.balance || 0)}</div>
                                <div className="text-xs text-gray-500 mt-2">{account.accountNumber || account.id}</div>
                              </div>
                              <div className="text-right">
                                <div className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-xs font-medium rounded">
                                  Расчётный счёт
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">Загрузка данных о клиенте...</p>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* AI Chat Component */}
      <AIChat />

      <TransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        accounts={allAccounts}
        fromAccount={selectedFromAccount}
        onTransfer={handleTransfer}
      />

      <CreateAccountModal
        isOpen={createAccountModalOpen}
        onClose={() => setCreateAccountModalOpen(false)}
        onAccountCreated={() => {
          loadData()
          setNotifications([
            ...notifications,
            {
              id: generateId(),
              title: 'Счет успешно создан',
              message: 'Новый счет добавлен в ваш профиль',
              type: 'success',
              timestamp: new Date().toISOString(),
              read: false,
            },
          ])
        }}
      />

      <AccountDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        account={selectedAccountForDetails}
      />
    </div>
  )
}
