'use client'

import { BankAccount, Transaction } from '@/types'
import AccountCard from './AccountCard'
import AccountsTable from './AccountsTable'
import TransactionList from './TransactionList'
import BalanceSummary from './BalanceSummary'
import QuickStats from './QuickStats'
import { RefreshCw, Download } from 'lucide-react'
import { forecastBalance } from '@/utils/forecast'
import { useMemo } from 'react'

interface DashboardProps {
  accounts: BankAccount[]
  transactions: Transaction[]
  loading: boolean
  onRefresh: () => void
  onTransfer?: (account: BankAccount) => void
  onExport?: () => void
  onDeleteAccount?: (accountId: string) => void
}

export default function Dashboard({ accounts, transactions, loading, onRefresh, onTransfer, onExport, onDeleteAccount }: DashboardProps) {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
  
  // Прогноз баланса на конец месяца
  const forecastedBalance = useMemo(() => {
    return forecastBalance(totalBalance, transactions, 'month')
  }, [totalBalance, transactions])

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Добро пожаловать</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-base sm:text-lg">Полный обзор ваших финансов</p>
      </div>

      {/* Balance Summary */}
      <BalanceSummary totalBalance={totalBalance} accounts={accounts} forecastedBalance={forecastedBalance} />

      {/* Quick Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <QuickStats transactions={transactions} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts Section */}
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Счета</h2>
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition text-sm"
              >
                <Download className="h-4 w-4" />
                <span>Экспорт</span>
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <AccountsTable 
              accounts={accounts} 
              onTransfer={onTransfer}
              onDelete={onDeleteAccount}
            />
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Недавние</h2>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center justify-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 text-sm whitespace-nowrap"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Обновить</span>
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <TransactionList transactions={transactions.slice(0, 8)} />
          </div>
        </div>
      </div>
    </div>
  )
}

