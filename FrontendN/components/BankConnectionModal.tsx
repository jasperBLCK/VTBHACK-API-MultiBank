'use client'

import { useState } from 'react'
import { X, Building2 } from 'lucide-react'

interface BankConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect: (bankName: string) => void
}

const availableBanks = [
  { name: 'ВТБ', id: 'vtb', color: 'bg-blue-600' },
  { name: 'Сбербанк', id: 'sberbank', color: 'bg-green-600' },
  { name: 'Альфа-Банк', id: 'alfabank', color: 'bg-red-600' },
  { name: 'Тинькофф', id: 'tinkoff', color: 'bg-yellow-600' },
  { name: 'Райффайзен', id: 'raiffeisen', color: 'bg-orange-600' },
]

export default function BankConnectionModal({ isOpen, onClose, onConnect }: BankConnectionModalProps) {
  const [selectedBank, setSelectedBank] = useState<string>('')

  if (!isOpen) return null

  const handleConnect = () => {
    if (selectedBank) {
      onConnect(selectedBank)
      setSelectedBank('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Подключить банк</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
            Выберите банк для подключения. Вам потребуется авторизоваться через API банка.
          </p>

          <div className="space-y-2 mb-4 sm:mb-6">
            {availableBanks.map((bank) => (
              <button
                key={bank.id}
                onClick={() => setSelectedBank(bank.id)}
                className={`w-full flex items-center space-x-3 p-3 sm:p-4 border-2 rounded-lg transition ${
                  selectedBank === bank.id
                    ? 'border-primary-600 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                }`}
              >
                <div className={`h-8 w-8 sm:h-10 sm:w-10 ${bank.color} rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0`}>
                  {bank.name[0]}
                </div>
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{bank.name}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm sm:text-base"
            >
              Отмена
            </button>
            <button
              onClick={handleConnect}
              disabled={!selectedBank}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              Подключить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

