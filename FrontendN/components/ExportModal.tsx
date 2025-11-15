'use client'

import { useState } from 'react'
import { ExportOptions, BankAccount } from '@/types'
import { X, Download, FileText, FileJson, FileSpreadsheet } from 'lucide-react'
import { exportTransactions } from '@/utils/export'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: BankAccount[]
  transactions: any[]
}

export default function ExportModal({ isOpen, onClose, accounts, transactions }: ExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'json' | 'xlsx'>('csv')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(accounts.map(acc => acc.id))
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleExport = async () => {
    setLoading(true)
    try {
      const options: ExportOptions = {
        format,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        accountIds: selectedAccounts,
      }

      await exportTransactions(transactions, accounts, options)
      onClose()
    } catch (error) {
      console.error('Ошибка экспорта:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }

  const formatIcons = {
    csv: FileText,
    json: FileJson,
    xlsx: FileSpreadsheet,
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Экспорт данных</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Формат экспорта
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['csv', 'json', 'xlsx'] as const).map((fmt) => {
                const Icon = formatIcons[fmt]
                return (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={`p-4 border-2 rounded-lg transition ${
                      format === fmt
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-6 w-6 mx-auto mb-2" />
                    <span className="text-sm font-medium uppercase">{fmt}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Период
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="От"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="До"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Счета
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {accounts.map(acc => (
                <label
                  key={acc.id}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    {acc.bankName} •••• {acc.accountNumber.slice(-4)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm sm:text-base"
            >
              Отмена
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <Download className="h-4 w-4" />
              <span>{loading ? 'Экспорт...' : 'Экспортировать'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

