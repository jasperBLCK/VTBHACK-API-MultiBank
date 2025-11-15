'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import { Transaction, Notification } from '@/types'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useSettings } from '@/contexts/SettingsContext'
import { formatCurrency } from '@/utils/format'

const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36)

export default function AnalyticsPage() {
  const { settings } = useSettings()
  const [isDark, setIsDark] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
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

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const handleRemoveNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  useEffect(() => {
    // Загрузка транзакций
    const mockTransactions: Transaction[] = [
      { id: '1', accountId: '1', amount: -5000, currency: 'RUB', description: 'Покупка в магазине', date: new Date('2024-11-15'), category: 'shopping' },
      { id: '2', accountId: '1', amount: 30000, currency: 'RUB', description: 'Зарплата', date: new Date('2024-11-10'), category: 'income' },
      { id: '3', accountId: '1', amount: -2000, currency: 'RUB', description: 'Кафе', date: new Date('2024-11-12'), category: 'food' },
      { id: '4', accountId: '1', amount: -1500, currency: 'RUB', description: 'Такси', date: new Date('2024-11-11'), category: 'transport' },
    ]
    setTransactions(mockTransactions)
  }, [])

  const categoryNames: Record<string, string> = {
    food: 'Еда',
    transport: 'Транспорт',
    shopping: 'Покупки',
    bills: 'Счета',
    entertainment: 'Развлечения',
    health: 'Здоровье',
    education: 'Образование',
    income: 'Доходы',
    other: 'Прочее',
  }

  const categoryData = transactions.reduce((acc, t) => {
    if (t.amount < 0) {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount)
    }
    return acc
  }, {} as Record<string, number>)

  const allChartData = Object.entries(categoryData).map(([name, value]) => ({
    name: categoryNames[name] || name,
    value,
    category: name,
  })).filter(item => item.value > 0)
  
  const totalValue = allChartData.reduce((sum, item) => sum + item.value, 0)
  
  // Группируем маленькие значения (менее 5%) в "Прочее"
  const threshold = 5 // 5%
  const chartDataWithPercent = allChartData.map(item => ({
    ...item,
    percent: (item.value / totalValue) * 100,
  })).sort((a, b) => b.value - a.value)
  
  const mainItems = chartDataWithPercent.filter(item => item.percent >= threshold)
  const otherItems = chartDataWithPercent.filter(item => item.percent < threshold)
  const otherTotal = otherItems.reduce((sum, item) => sum + item.value, 0)
  
  const chartData = [
    ...mainItems,
    ...(otherTotal > 0 ? [{
      name: 'Прочее',
      value: otherTotal,
      category: 'other',
      percent: (otherTotal / totalValue) * 100,
    }] : [])
  ]

  const COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981']

  const monthlyData = [
    { month: 'Сент', income: 30000, expenses: 15000 },
    { month: 'Окт', income: 35000, expenses: 18000 },
    { month: 'Нояб', income: 30000, expenses: 8500 },
  ]

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
          <div className="mb-4 sm:mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Аналитика</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Анализ ваших финансов</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Доходы и расходы</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: isDark ? '#d1d5db' : '#6b7280' }}
                    stroke={isDark ? '#4b5563' : '#9ca3af'}
                  />
                  <YAxis 
                    tick={{ fill: isDark ? '#d1d5db' : '#6b7280' }}
                    stroke={isDark ? '#4b5563' : '#9ca3af'}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatCurrency(value, 'RUB'), 
                      name === 'income' ? 'Доходы' : 'Расходы'
                    ]}
                    labelFormatter={(label: string) => `Месяц: ${label}`}
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
                  <Legend 
                    wrapperStyle={{ color: isDark ? '#d1d5db' : '#6b7280' }}
                  />
                  <Bar dataKey="income" fill="#10b981" name="Доходы" />
                  <Bar dataKey="expenses" fill="#ef4444" name="Расходы" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Расходы по категориям</h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                    <Pie
                      data={chartData}
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
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          stroke={isDark ? '#1f2937' : '#ffffff'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => {
                        const total = chartData.reduce((sum, item) => sum + item.value, 0)
                        return [
                          formatCurrency(value, 'RUB'), 
                          `${((value / total) * 100).toFixed(1)}%`
                        ]
                      }}
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
                        const item = chartData.find(d => d.name === value)
                        if (item && 'percent' in item) {
                          return `${value} — ${item.percent.toFixed(1)}%`
                        }
                        return value
                      }}
                      layout="horizontal"
                      align="center"
                    />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Динамика баланса</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  dataKey="month"
                  tick={{ fill: isDark ? '#d1d5db' : '#6b7280' }}
                  stroke={isDark ? '#4b5563' : '#9ca3af'}
                />
                <YAxis 
                  tick={{ fill: isDark ? '#d1d5db' : '#6b7280' }}
                  stroke={isDark ? '#4b5563' : '#9ca3af'}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value, 'RUB'),
                    name === 'income' ? 'Доходы' : 'Расходы'
                  ]}
                  labelFormatter={(label: string) => `Месяц: ${label}`}
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
                <Legend
                  wrapperStyle={{ color: isDark ? '#d1d5db' : '#6b7280' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#10b981" 
                  name="Доходы"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#ef4444" 
                  name="Расходы"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </main>
      </div>
    </div>
  )
}

