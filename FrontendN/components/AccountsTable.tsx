'use client'

import { BankAccount } from '@/types'
import { formatCurrency } from '@/utils/format'
import { CreditCard, Trash2, ArrowRight, Building2 } from 'lucide-react'
import { useState } from 'react'

interface AccountsTableProps {
  accounts: BankAccount[]
  onTransfer?: (account: BankAccount) => void
  onDelete?: (accountId: string) => void
}

export default function AccountsTable({ accounts, onTransfer, onDelete }: AccountsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (accountId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот счет из списка?')) {
      return
    }
    
    setDeletingId(accountId)
    try {
      if (onDelete) {
        await onDelete(accountId)
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Нет доступных счетов</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Банк</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Номер счета</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Тип</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Баланс</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Валюта</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Действия</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr
              key={account.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
            >
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  {account.bankName?.includes('Virtual') || account.bankName?.includes('Awesome') || account.bankName?.includes('Smart') ? (
                    <Building2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {account.bankName || 'Основной банк'}
                  </span>
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                    {account.accountNumber.length > 20 
                      ? `•••• ${account.accountNumber.slice(-4)}`
                      : account.accountNumber}
                  </span>
                  {account.cards && account.cards.length > 0 && (
                    <span className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                      💳 {account.cards[0].cardNumber} {account.cards[0].expiryDate || ''}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {account.type === 'savings' ? 'Накопительный' : 
                   account.type === 'credit' ? 'Кредитный' : 
                   'Текущий'}
                </span>
              </td>
              <td className="py-4 px-4 text-right">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(account.balance, account.currency)}
                </span>
              </td>
              <td className="py-4 px-4 text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">{account.currency}</span>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center justify-end gap-2">
                  {onTransfer && (
                    <button
                      onClick={() => onTransfer(account)}
                      className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition"
                      title="Перевести"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(account.id)}
                      disabled={deletingId === account.id}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition disabled:opacity-50"
                      title="Удалить"
                    >
                      <Trash2 className={`h-4 w-4 ${deletingId === account.id ? 'animate-pulse' : ''}`} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

