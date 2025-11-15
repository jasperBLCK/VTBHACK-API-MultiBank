'use client'

import React, { useState, useEffect } from 'react'
import { X, FileText, Copy, CheckCircle } from 'lucide-react'

interface BankAccount {
  id: string
  account_number?: string
  accountNumber?: string
  balance?: number
  currency?: string
  account_type?: string
  accountType?: string
  status?: string
  opened_at?: string
  openedAt?: string
  [key: string]: any
}

interface AccountDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  account: BankAccount | null
}

export default function AccountDetailsModal({
  isOpen,
  onClose,
  account,
}: AccountDetailsModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !account) return null

  const accountNumber = account.account_number || account.accountNumber || 'N/A'
  const balance = account.balance || 0
  const currency = account.currency || 'RUB'
  const accountType = account.account_type || account.accountType || 'Unknown'
  const status = account.status || 'active'
  const openedAt = account.opened_at || account.openedAt || 'N/A'

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Детали счета</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Account Number */}
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Номер счета</p>
            <div className="flex items-center justify-between">
              <p className="text-lg font-mono font-semibold text-white">
                {accountNumber}
              </p>
              <button
                onClick={() => handleCopy(accountNumber)}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title="Скопировать"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Balance */}
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Баланс</p>
            <p className="text-2xl font-bold text-green-500">
              {balance.toLocaleString('ru-RU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {currency}
            </p>
          </div>

          {/* Account Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Тип счета</p>
              <p className="text-sm font-semibold text-white capitalize">
                {accountType === 'checking' ? 'Расчётный' : accountType}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Статус</p>
              <p className="text-sm font-semibold">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    status === 'active'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-red-900 text-red-200'
                  }`}
                >
                  {status === 'active' ? 'Активен' : 'Закрыт'}
                </span>
              </p>
            </div>
          </div>

          {/* Opened Date */}
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Дата открытия</p>
            <p className="text-sm font-semibold text-white">
              {formatDate(openedAt)}
            </p>
          </div>

          {/* Additional Info */}
          {account.id && (
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">ID счета</p>
              <p className="text-xs font-mono text-gray-300 break-all">
                {account.id}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
