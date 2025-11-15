'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import LoadingScreen from '@/components/LoadingScreen'
import { Budget, Transaction, Notification } from '@/types'
import { 
  Wallet, Plus, AlertCircle, TrendingUp, TrendingDown, 
  Target, PieChart, Calendar, BarChart3, Minus, Receipt
} from 'lucide-react'
import { categorizeTransactions } from '@/utils/categorize'
import { formatCurrency } from '@/utils/format'
import { calculateSpent, calculateBudgetUsage, getRemainingBudget, willExceedBudget } from '@/utils/budget'
import { forecastAllCategories } from '@/utils/forecast'
import { endOfMonth, differenceInDays, startOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts'
import { useSettings } from '@/contexts/SettingsContext'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1']

export default function BudgetPage() {
  const { settings } = useSettings()
  const [isDark, setIsDark] = useState(false)
  
  useEffect(() => {
    const updateTheme = () => {
      if (settings.theme === 'dark') {
        setIsDark(true)
      } else if (settings.theme === 'light') {
        setIsDark(false)
      } else {
        // system
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    }
    
    updateTheme()
    
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', updateTheme)
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }
  }, [settings.theme])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [newBudget, setNewBudget] = useState({
    category: 'food',
    amount: '',
    period: 'monthly' as 'monthly' | 'yearly',
  })
  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: 'food',
    description: '',
    date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {}

      // Загрузка данных из API
      const [budgetsRes, transactionsRes, notificationsRes] = await Promise.all([
        fetch('/api/budgets', { headers }),
        fetch('/api/transactions', { headers }),
        fetch('/api/notifications', { headers }),
      ])

      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json()
        // Преобразуем даты из строк в объекты Date
        const budgetsWithDates = budgetsData.map((b: any) => ({
          ...b,
          startDate: typeof b.startDate === 'string' ? new Date(b.startDate) : b.startDate,
          endDate: b.endDate && typeof b.endDate === 'string' ? new Date(b.endDate) : b.endDate,
        }))
        setBudgets(budgetsWithDates)
      }

      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json()
        // Преобразуем даты из строк в объекты Date
        const transactionsWithDates = transactionsData.map((t: any) => ({
          ...t,
          date: typeof t.date === 'string' ? new Date(t.date) : t.date,
        }))
        // Автоматически категоризируем транзакции без категорий
        const categorized = categorizeTransactions(transactionsWithDates)
        setTransactions(categorized)
      }

      if (notificationsRes.ok) {
        const notificationsData = await notificationsRes.json()
        // Преобразуем даты в уведомлениях
        const notificationsWithDates = notificationsData.map((n: any) => ({
          ...n,
          timestamp: typeof n.timestamp === 'string' ? new Date(n.timestamp) : n.timestamp,
        }))
        setNotifications(notificationsWithDates)
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
      // Fallback на пустые массивы если API недоступен
      setBudgets([])
      setTransactions([])
    }
  }

  const handleAddBudget = async () => {
    if (!newBudget.amount || parseFloat(newBudget.amount) <= 0) return

    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: newBudget.category,
          amount: parseFloat(newBudget.amount),
          period: newBudget.period,
        }),
      })

      if (res.ok) {
        await loadData() // Перезагружаем данные
        setNewBudget({ category: 'food', amount: '', period: 'monthly' })
        setShowAddBudget(false)
      } else {
        throw new Error('Ошибка создания бюджета')
      }
    } catch (error) {
      console.error('Ошибка создания бюджета:', error)
      // Fallback на локальное добавление
      const budget: Budget = {
        id: Date.now().toString(),
        category: newBudget.category,
        amount: parseFloat(newBudget.amount),
        period: newBudget.period,
        startDate: new Date(),
      }
      setBudgets([...budgets, budget])
      setNewBudget({ category: 'food', amount: '', period: 'monthly' })
      setShowAddBudget(false)
    }
  }

  const handleAddExpense = async () => {
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) return
    if (!newExpense.description.trim()) return

    try {
      const token = localStorage.getItem('access_token')
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }

      // Получаем первый счет для транзакции
      const accountsRes = await fetch('/api/accounts', { headers: { 'Authorization': `Bearer ${token}` } })
      const accounts = accountsRes.ok ? await accountsRes.json() : []
      const accountId = accounts.length > 0 ? accounts[0].id : '1'

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountId,
          amount: -Math.abs(parseFloat(newExpense.amount)),
          currency: 'RUB',
          description: newExpense.description,
          date: newExpense.date,
          category: newExpense.category,
          type: 'payment',
        }),
      })

      if (res.ok) {
        // Создаем уведомление
        await fetch('/api/notifications', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: 'success',
            title: 'Расход добавлен',
            message: `Добавлен расход на сумму ${formatCurrency(Math.abs(parseFloat(newExpense.amount)), 'RUB')}`,
          }),
        })

        await loadData() // Перезагружаем данные
        setNewExpense({
          amount: '',
          category: 'food',
          description: '',
          date: new Date().toISOString().split('T')[0],
        })
        setShowAddExpense(false)
      } else {
        throw new Error('Ошибка создания расхода')
      }
    } catch (error) {
      console.error('Ошибка создания расхода:', error)
      // Fallback на локальное добавление
      const expense: Transaction = {
        id: Date.now().toString(),
        accountId: '1',
        amount: -Math.abs(parseFloat(newExpense.amount)),
        currency: 'RUB',
        description: newExpense.description,
        date: new Date(newExpense.date),
        category: newExpense.category as Transaction['category'],
        type: 'payment',
      }
      setTransactions([...transactions, expense])
      setNewExpense({
        amount: '',
        category: 'food',
        description: '',
        date: new Date().toISOString().split('T')[0],
      })
      setShowAddExpense(false)
    }
  }

  const forecasts = useMemo(() => forecastAllCategories(transactions, 'month'), [transactions])
  const monthEnd = endOfMonth(new Date())
  const daysRemaining = differenceInDays(monthEnd, new Date())

  const budgetData = budgets.map(budget => {
    const spent = calculateSpent(budget, transactions)
    const usage = calculateBudgetUsage(budget, transactions)
    const remaining = getRemainingBudget(budget, transactions)
    const willExceed = willExceedBudget(budget, transactions, daysRemaining)

    return {
      ...budget,
      spent,
      usage,
      remaining,
      willExceed,
    }
  })

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + calculateSpent(b, transactions), 0)
  const totalRemaining = totalBudget - totalSpent

  const categoryNames: Record<string, string> = {
    food: 'Еда',
    transport: 'Транспорт',
    shopping: 'Покупки',
    bills: 'Счета',
    entertainment: 'Развлечения',
    health: 'Здоровье',
    education: 'Образование',
    other: 'Прочее',
  }

  const pieData = budgets.map(budget => ({
    name: categoryNames[budget.category] || budget.category,
    value: calculateSpent(budget, transactions),
    category: budget.category,
  }))

  // Преобразуем данные прогноза с русскими названиями
  const forecastData = forecasts
    .filter(f => f.predictedAmount > 0)
    .map(forecast => ({
      ...forecast,
      categoryName: categoryNames[forecast.category] || forecast.category,
      прогнозируемаяСумма: forecast.predictedAmount,
    }))

  // Фильтруем и группируем маленькие значения для круговой диаграммы
  const totalSpentInPie = pieData.reduce((sum, item) => sum + item.value, 0)
  const pieDataFiltered = pieData
    .filter(item => item.value > 0)
    .map(item => ({
      ...item,
      percent: (item.value / totalSpentInPie) * 100,
    }))
    .sort((a, b) => b.value - a.value)
  
  // Группируем маленькие значения (менее 5%) в "Прочее"
  const threshold = 5 // 5%
  const mainItems = pieDataFiltered.filter(item => item.percent >= threshold)
  const otherItems = pieDataFiltered.filter(item => item.percent < threshold)
  const otherTotal = otherItems.reduce((sum, item) => sum + item.value, 0)
  
  const finalPieData = [
    ...mainItems,
    ...(otherTotal > 0 ? [{
      name: 'Прочее',
      value: otherTotal,
      category: 'other',
      percent: (otherTotal / totalSpentInPie) * 100,
    }] : [])
  ]

  // Показываем загрузочный экран при первой загрузке
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  useEffect(() => {
    if (budgets.length > 0 || transactions.length > 0) {
      setIsInitialLoad(false)
    }
  }, [budgets.length, transactions.length])

  if (isInitialLoad && budgets.length === 0 && transactions.length === 0) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header 
        notifications={notifications}
        onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        onMarkAsRead={async (id) => {
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
            console.error('Ошибка обновления уведомления:', error)
            setNotifications(prev =>
              prev.map(n => n.id === id ? { ...n, read: true } : n)
            )
          }
        }}
        onRemoveNotification={async (id) => {
          try {
            const token = localStorage.getItem('access_token')
            await fetch(`/api/notifications?id=${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            })
            setNotifications(prev => prev.filter(n => n.id !== id))
          } catch (error) {
            console.error('Ошибка удаления уведомления:', error)
            setNotifications(prev => prev.filter(n => n.id !== id))
          }
        }}
      />
      <div className="flex relative flex-1">
        <Sidebar 
          isMobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Бюджет</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Управление бюджетом и контроль расходов</p>
            
            {/* Переключатель периода */}
            <div className="mt-4 flex gap-2">
              {(['week', 'month', 'year'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-lg transition ${
                    selectedPeriod === period
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Год'}
                </button>
              ))}
            </div>
          </div>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>Добавить трату</span>
                </button>
                <button
                  onClick={() => setShowAddBudget(true)}
                  className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>Добавить бюджет</span>
                </button>
              </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Общий бюджет</span>
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalBudget, 'RUB')}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Потрачено</span>
                  <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalSpent, 'RUB')}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Осталось</span>
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalRemaining, 'RUB')}</p>
              </div>
            </div>

            {/* Список бюджетов */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {budgetData.map(budget => (
                <div
                  key={budget.id}
                  className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                        {categoryNames[budget.category] || budget.category}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        Бюджет: {formatCurrency(budget.amount, 'RUB')}
                      </p>
                    </div>
                    {budget.willExceed && (
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs sm:text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Потрачено</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(budget.spent, 'RUB')} ({Math.round(budget.usage)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-3">
                      <div
                        className={`h-2 sm:h-3 rounded-full ${
                          budget.usage > 100
                            ? 'bg-red-600'
                            : budget.usage > 80
                            ? 'bg-orange-500'
                            : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(budget.usage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Осталось:</span>
                    <span className={`font-semibold ${budget.remaining > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(budget.remaining, 'RUB')}
                    </span>
                  </div>

                  {budget.willExceed && (
                    <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-700 dark:text-orange-400">
                      ⚠️ Возможно превышение бюджета до конца месяца
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Умные рекомендации на основе прогнозов */}
            {forecastData.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 sm:p-6 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800 mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                  Умные рекомендации и прогнозы
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {forecastData.slice(0, 4).map(forecast => {
                    const budget = budgets.find(b => b.category === forecast.category)
                    const currentSpent = budget ? calculateSpent(budget, transactions) : 0
                    const projectedTotal = currentSpent + forecast.predictedAmount
                    const budgetAmount = budget?.amount || 0
                    const willExceedForecast = budgetAmount > 0 && projectedTotal > budgetAmount
                    const daysLeft = differenceInDays(endOfMonth(new Date()), new Date())
                    const dailyAverage = daysLeft > 0 ? forecast.predictedAmount / daysLeft : 0

                    return (
                      <div key={forecast.category} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                              {categoryNames[forecast.category]}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Прогноз до конца месяца
                            </p>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            forecast.trend === 'up' 
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : forecast.trend === 'down'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {forecast.trend === 'up' ? '↗' : forecast.trend === 'down' ? '↘' : '→'} 
                            {forecast.trend === 'up' ? ' Растет' : forecast.trend === 'down' ? ' Снижается' : ' Стабильно'}
                          </div>
                        </div>
                        
                        <div className="space-y-2 mt-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">Ожидается трат:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(forecast.predictedAmount, 'RUB')}
                            </span>
                          </div>
                          {budget && (
                            <>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">Итого за месяц:</span>
                                <span className={`font-semibold ${willExceedForecast ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                  {formatCurrency(projectedTotal, 'RUB')}
                                </span>
                              </div>
                              {willExceedForecast && (
                                <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs text-orange-700 dark:text-orange-400">
                                  ⚠️ Превысит бюджет на {formatCurrency(projectedTotal - budgetAmount, 'RUB')}
                                </div>
                              )}
                              {!willExceedForecast && budgetAmount > 0 && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-400">
                                  ✓ Средний расход в день: {formatCurrency(dailyAverage, 'RUB')}
                                </div>
                              )}
                            </>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Уверенность: {Math.round(forecast.confidence * 100)}%
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Графики */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Распределение расходов</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <RechartsPieChart>
                    <Pie
                      data={finalPieData}
                      cx="50%"
                      cy="45%"
                      labelLine={{
                        stroke: isDark ? '#9ca3af' : '#6b7280',
                        strokeWidth: 1.5,
                      }}
                      label={({ percent }) => {
                        // Показываем только проценты для сегментов больше 10%
                        // Названия категорий будут в легенде
                        if (percent >= 10) {
                          return `${(percent).toFixed(0)}%`
                        }
                        return ''
                      }}
                      outerRadius={110}
                      innerRadius={50}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={3}
                      stroke={isDark ? '#1f2937' : '#ffffff'}
                      strokeWidth={2}
                    >
                      {finalPieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          stroke={isDark ? '#1f2937' : '#ffffff'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value, 'RUB'), 
                        `${((value / totalSpentInPie) * 100).toFixed(1)}%`
                      ]}
                      labelFormatter={(label: string) => label}
                      contentStyle={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: isDark ? '#f9fafb' : '#111827',
                        padding: '8px 12px',
                      }}
                      labelStyle={{
                        color: isDark ? '#f9fafb' : '#111827',
                        fontWeight: 600,
                        marginBottom: '4px',
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={80}
                      iconType="circle"
                      wrapperStyle={{ 
                        color: isDark ? '#d1d5db' : '#6b7280',
                        fontSize: '14px',
                        paddingTop: '20px',
                        fontWeight: 500,
                      }}
                      formatter={(value: string) => {
                        const item = finalPieData.find(d => d.name === value)
                        if (item) {
                          return `${value} — ${item.percent.toFixed(1)}%`
                        }
                        return value
                      }}
                      layout="horizontal"
                      align="center"
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Прогноз расходов</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis 
                      dataKey="categoryName" 
                      tick={{ fill: isDark ? '#d1d5db' : '#6b7280' }}
                      stroke={isDark ? '#4b5563' : '#9ca3af'}
                    />
                    <YAxis 
                      tick={{ fill: isDark ? '#d1d5db' : '#6b7280' }}
                      stroke={isDark ? '#4b5563' : '#9ca3af'}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value, 'RUB'), 'Прогнозируемая сумма']}
                      labelFormatter={(label: string) => label}
                      contentStyle={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: isDark ? '#f9fafb' : '#111827',
                      }}
                      labelStyle={{
                        color: isDark ? '#f9fafb' : '#111827',
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="predictedAmount" fill="#3b82f6" name="Прогнозируемая сумма" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Последние транзакции */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Последние траты</h3>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Добавить
                </button>
              </div>
              {transactions.filter(t => t.amount < 0).length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Нет трат</p>
                  <button
                    onClick={() => setShowAddExpense(true)}
                    className="mt-2 text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Добавить первую трату
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions
                    .filter(t => t.amount < 0)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 10)
                    .map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {transaction.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {categoryNames[transaction.category] || transaction.category}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(transaction.date).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Модальное окно добавления траты */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddExpense(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">Добавить трату</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Сумма</label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Категория</label>
                <select
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  {Object.entries(categoryNames).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Описание</label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Например: Обед в кафе"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Дата</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAddExpense(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddExpense}
                  disabled={!newExpense.amount || !newExpense.description.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления бюджета */}
      {showAddBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddBudget(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">Добавить бюджет</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Категория</label>
                <select
                  value={newBudget.category}
                  onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  {Object.entries(categoryNames).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Сумма</label>
                <input
                  type="number"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Период</label>
                <select
                  value={newBudget.period}
                  onChange={(e) => setNewBudget({ ...newBudget, period: e.target.value as 'monthly' | 'yearly' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="monthly">Месяц</option>
                  <option value="yearly">Год</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAddBudget(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddBudget}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

