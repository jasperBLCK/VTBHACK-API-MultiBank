'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'
import TransactionList from '@/components/TransactionList'
import ExportModal from '@/components/ExportModal'
import { Transaction, BankAccount, Notification } from '@/types'
import { Filter, Search, Download } from 'lucide-react'

const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36)

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const mockAccounts: BankAccount[] = [
      { id: '1', bankName: 'ВТБ', accountNumber: '40817810099910004312', balance: 125000.50, currency: 'RUB', type: 'debit' },
      { id: '2', bankName: 'Сбербанк', accountNumber: '40817810099910004313', balance: 50000.00, currency: 'RUB', type: 'debit' },
    ]
    const mockTransactions: Transaction[] = [
      { id: '1', accountId: '1', amount: -5000, currency: 'RUB', description: 'Покупка в магазине', date: new Date('2024-11-15'), category: 'shopping' },
      { id: '2', accountId: '1', amount: 30000, currency: 'RUB', description: 'Зарплата', date: new Date('2024-11-10'), category: 'income' },
      { id: '3', accountId: '1', amount: -2000, currency: 'RUB', description: 'Кафе', date: new Date('2024-11-12'), category: 'food' },
      { id: '4', accountId: '1', amount: -1500, currency: 'RUB', description: 'Такси', date: new Date('2024-11-11'), category: 'transport' },
      { id: '5', accountId: '2', amount: -3000, currency: 'RUB', description: 'Коммунальные услуги', date: new Date('2024-11-08'), category: 'bills' },
    ]
    setAccounts(mockAccounts)
    setTransactions(mockTransactions)
    setFilteredTransactions(mockTransactions)
  }, [])

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const handleRemoveNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  useEffect(() => {
    let filtered = transactions

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory)
    }

    setFilteredTransactions(filtered)
  }, [searchQuery, selectedCategory, transactions])

  const categories = [
    { value: 'all', label: 'Все' },
    { value: 'income', label: 'Доходы' },
    { value: 'shopping', label: 'Покупки' },
    { value: 'food', label: 'Еда' },
    { value: 'transport', label: 'Транспорт' },
    { value: 'bills', label: 'Счета' },
    { value: 'other', label: 'Прочее' },
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">История транзакций</h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Все ваши операции</p>
            </div>
            <button
              onClick={() => setExportModalOpen(true)}
              className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm sm:text-base"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Экспорт</span>
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Поиск транзакций..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <TransactionList transactions={filteredTransactions} />
        </main>
      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        accounts={accounts}
        transactions={transactions}
      />
    </div>
  )
}

