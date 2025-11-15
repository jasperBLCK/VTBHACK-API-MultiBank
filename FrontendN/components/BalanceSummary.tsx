'use client'

import { BankAccount } from '@/types'
import { formatCurrency } from '@/utils/format'
import { TrendingUp, Wallet } from 'lucide-react'

interface BalanceSummaryProps {
  totalBalance: number
  accounts: BankAccount[]
  forecastedBalance?: number
}

export default function BalanceSummary({ totalBalance, accounts, forecastedBalance }: BalanceSummaryProps) {
  const rubAccounts = accounts.filter(acc => acc.currency === 'RUB')
  const totalRub = rubAccounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl shadow-lg p-4 sm:p-6 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            <span className="text-white/90 text-xs sm:text-sm font-medium">Общий баланс</span>
          </div>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 text-white">{formatCurrency(totalRub, 'RUB')}</h3>
          <p className="text-white/80 text-xs sm:text-sm">
            {accounts.length} {accounts.length === 1 ? 'счет' : accounts.length < 5 ? 'счета' : 'счетов'}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            <span className="text-white/90 text-xs sm:text-sm font-medium">
              {forecastedBalance ? 'Прогноз на конец месяца' : 'За месяц'}
            </span>
          </div>
          {forecastedBalance ? (
            <>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {formatCurrency(forecastedBalance, 'RUB')}
              </p>
              <p className="text-white/80 text-xs sm:text-sm">
                {forecastedBalance > totalRub ? '+' : ''}
                {formatCurrency(forecastedBalance - totalRub, 'RUB')}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl sm:text-2xl font-bold text-white">+12.5%</p>
              <p className="text-white/80 text-xs sm:text-sm">+{formatCurrency(15000, 'RUB')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

