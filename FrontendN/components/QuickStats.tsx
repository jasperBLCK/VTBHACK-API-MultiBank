'use client'

import { Transaction } from '@/types'
import { formatCurrency } from '@/utils/format'
import { ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react'

interface QuickStatsProps {
  transactions: Transaction[]
}

export default function QuickStats({ transactions }: QuickStatsProps) {
  const income = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  
  const expenses = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const net = income - expenses

  const stats = [
    {
      label: 'Доходы',
      value: formatCurrency(income, 'RUB'),
      icon: ArrowDownLeft,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Расходы',
      value: formatCurrency(expenses, 'RUB'),
      icon: ArrowUpRight,
      color: 'text-red-600 bg-red-50',
    },
    {
      label: 'Итого',
      value: formatCurrency(net, 'RUB'),
      icon: TrendingUp,
      color: net >= 0 ? 'text-blue-600 bg-blue-50' : 'text-red-600 bg-red-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{stat.label}</span>
              <div className={`p-1.5 sm:p-2 rounded-lg ${stat.color} dark:opacity-80`}>
                <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{stat.value}</p>
          </div>
        )
      })}
    </div>
  )
}

