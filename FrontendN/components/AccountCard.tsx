'use client'

import { BankAccount } from '@/types'
import { CreditCard, TrendingUp, TrendingDown, ArrowRight, Trash2, FileText } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { useState } from 'react'

interface BankCard {
  cardId: string
  cardNumber: string // Маскированный номер типа "*3245"
  expiryDate?: string // "03/27"
  cardName?: string
  cardType?: string
  status?: string
  accountNumber?: string
}

interface AccountCardProps {
  account: BankAccount & { cards?: BankCard[] }
  onTransfer?: (account: BankAccount) => void
  onDelete?: (accountId: string) => void
  onDetails?: (account: BankAccount) => void
}

export default function AccountCard({ account, onTransfer, onDelete, onDetails }: AccountCardProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Вы уверены? Этот счет будет удален с базы данных.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}`,
        },
      })

      if (response.ok) {
        onDelete?.(account.id)
      } else {
        alert('Ошибка при удалении счета')
      }
    } catch (error) {
      console.error('Ошибка:', error)
      alert('Ошибка при удалении счета')
    } finally {
      setDeleting(false)
    }
  }
  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'debit':
        return 'Дебетовая'
      case 'credit':
        return 'Кредитная'
      case 'savings':
        return 'Накопительная'
      default:
        return 'Счет'
    }
  }

  // Форматируем номер карты для отображения (например, "*3245 03/27 827")
  const formatCardNumber = (card: BankCard) => {
    const parts = []
    if (card.cardNumber) {
      parts.push(card.cardNumber)
    }
    if (card.expiryDate) {
      parts.push(card.expiryDate)
    }
    // Если есть дополнительные цифры (например, CVV или последние цифры)
    if (card.cardNumber && card.cardNumber.length > 5) {
      const lastDigits = card.cardNumber.match(/\d{3,4}$/)
      if (lastDigits && !card.expiryDate) {
        // Если нет даты, но есть последние цифры
        parts.push(lastDigits[0])
      }
    }
    return parts.join(' ')
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Карточка банка (если есть) */}
      {account.cards && account.cards.length > 0 ? (
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <CreditCard className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium opacity-90">{account.bankName}</span>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">Баланс</p>
              <p className="text-lg font-bold">{formatCurrency(account.balance, account.currency)}</p>
            </div>
          </div>
          
          {/* Номер карты */}
          <div className="mb-4">
            <p className="text-xs opacity-75 mb-1">Номер карты</p>
            <p className="text-2xl font-mono tracking-wider">
              {formatCardNumber(account.cards[0])}
            </p>
          </div>

          {/* Информация о карте */}
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>{account.cards[0]?.cardName || getAccountTypeLabel(account.type)}</span>
            {account.cards[0]?.status && (
              <span className={`px-2 py-1 rounded-full ${
                account.cards[0].status === 'active' 
                  ? 'bg-green-500/30 text-green-100' 
                  : 'bg-gray-500/30 text-gray-100'
              }`}>
                {account.cards[0].status === 'active' ? 'Активна' : account.cards[0].status}
              </span>
            )}
          </div>
        </div>
      ) : (
        // Стандартная карточка счета (если нет карты)
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{account.bankName}</p>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{getAccountTypeLabel(account.type)}</h4>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Номер счета</p>
            <p className="text-base font-mono text-gray-700 dark:text-gray-300">
              {account.accountNumber.length > 20 
                ? `•••• ${account.accountNumber.slice(-4)}`
                : account.accountNumber}
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Баланс</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(account.balance, account.currency)}</p>
            </div>
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">+2.5%</span>
            </div>
          </div>
        </div>
      )}

      {/* Кнопки действий */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onTransfer?.(account)}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium text-sm"
            title="Перевести деньги"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">Перевод</span>
          </button>
          <button
            onClick={() => onDetails?.(account)}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition text-sm font-medium"
            title="Просмотреть детали"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Детали</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm font-medium disabled:opacity-50"
            title="Удалить счет"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{deleting ? '...' : 'Удалить'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

