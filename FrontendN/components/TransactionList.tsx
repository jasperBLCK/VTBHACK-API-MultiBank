'use client'

import { Transaction } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { ShoppingBag, Utensils, Car, Receipt, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

interface TransactionListProps {
  transactions: Transaction[]
}

const categoryIcons = {
  shopping: ShoppingBag,
  food: Utensils,
  transport: Car,
  bills: Receipt,
  income: ArrowDownLeft,
  other: Receipt,
}

const categoryColors = {
  shopping: 'bg-blue-100 text-blue-600',
  food: 'bg-orange-100 text-orange-600',
  transport: 'bg-purple-100 text-purple-600',
  bills: 'bg-red-100 text-red-600',
  income: 'bg-green-100 text-green-600',
  other: 'bg-gray-100 text-gray-600',
}

export default function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-500 dark:text-gray-400 text-center">Нет транзакций</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {transactions.map((transaction) => {
          const Icon = categoryIcons[transaction.category] || Receipt
          const isIncome = transaction.amount > 0
          
          return (
            <div key={transaction.id} className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
              <div className="flex items-start sm:items-center space-x-2 sm:space-x-3">
                <div className={`p-1.5 sm:p-2 rounded-lg ${categoryColors[transaction.category]} dark:opacity-80 flex-shrink-0`}>
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(transaction.date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-xs sm:text-sm font-semibold ${
                      isIncome ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {isIncome ? '+' : ''}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

