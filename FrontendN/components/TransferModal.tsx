'use client'

import { useState, useEffect, useMemo } from 'react'
import { BankAccount } from '@/types'
import { X, ArrowRight, AlertCircle, CheckCircle, CreditCard, Info, Zap } from 'lucide-react'
import { formatCurrency } from '@/utils/format'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: BankAccount[]
  fromAccount?: BankAccount
  onTransfer: (fromAccountId: string, toAccountId: string, amount: number, description: string) => Promise<void>
}

export default function TransferModal({ isOpen, onClose, accounts, fromAccount, onTransfer }: TransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState(fromAccount?.id || '')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (fromAccount) {
      setFromAccountId(fromAccount.id)
    }
  }, [fromAccount])

  useEffect(() => {
    if (!isOpen) {
      setAmount('')
      setDescription('')
      setToAccountId('')
      setError('')
      setShowPreview(false)
    }
  }, [isOpen])

  // Закрытие по ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showPreview) {
        onClose()
      } else if (e.key === 'Escape' && showPreview) {
        setShowPreview(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, showPreview, onClose])

  // ВСЕ хуки должны быть ДО условного возврата!
  const fromAccountData = accounts.find(acc => acc.id === fromAccountId)
  const toAccountData = accounts.find(acc => acc.id === toAccountId)
  // Ограничим список счетов только внутренними (локальными) счетами банка — исключаем Multibank/aggregated accounts
  const internalAccounts = accounts.filter(acc => {
    // multibank accounts в нашем UI имеют дополнительные поля (bankCode или metadata)
    const hasBankCode = (acc as any).bankCode !== undefined
    const hasMetadata = (acc as any).metadata !== undefined
    return !hasBankCode && !hasMetadata
  })

  const availableAccounts = internalAccounts.filter(acc => acc.id !== fromAccountId)

  // Вычисляем комиссию (если перевод между разными банками)
  const commission = useMemo(() => {
    if (!fromAccountData || !toAccountData) return 0
    if (fromAccountData.bankName === toAccountData.bankName) return 0
    // Комиссия 1% при переводе между разными банками
    const transferAmount = parseFloat(amount) || 0
    return transferAmount * 0.01
  }, [fromAccountData, toAccountData, amount])

  // Валидация суммы
  const amountValidation = useMemo(() => {
    if (!amount) return { valid: true, message: '' }
    const transferAmount = parseFloat(amount)
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return { valid: false, message: 'Сумма должна быть больше 0' }
    }
    if (fromAccountData && transferAmount > fromAccountData.balance) {
      return { valid: false, message: 'Недостаточно средств на счете' }
    }
    if (fromAccountData && transferAmount + commission > fromAccountData.balance) {
      return { valid: false, message: `Недостаточно средств (включая комиссию ${formatCurrency(commission, 'RUB')})` }
    }
    return { valid: true, message: '' }
  }, [amount, fromAccountData, commission])

  // Быстрые суммы (с учетом комиссии если перевод между банками)
  const quickAmounts = useMemo(() => {
    if (!fromAccountData || !toAccountData) return []
    const balance = fromAccountData.balance
    const isInterBank = fromAccountData.bankName !== toAccountData.bankName
    
    const calculateMax = () => {
      if (!isInterBank) return balance
      // Максимальная сумма с учетом комиссии 1%
      // balance = amount + commission = amount + amount * 0.01 = amount * 1.01
      // amount = balance / 1.01
      return Math.floor((balance / 1.01) * 100) / 100
    }
    
    const maxAmount = calculateMax()
    
    return [
      { label: '25%', value: Math.floor(maxAmount * 0.25 * 100) / 100 },
      { label: '50%', value: Math.floor(maxAmount * 0.5 * 100) / 100 },
      { label: '75%', value: Math.floor(maxAmount * 0.75 * 100) / 100 },
      { label: 'Все', value: maxAmount },
    ]
  }, [fromAccountData, toAccountData])

  // Условный возврат ПОСЛЕ всех хуков
  if (!isOpen) return null

  const handleQuickAmount = (value: number) => {
    setAmount(value.toFixed(2))
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Разрешаем только числа и точку
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fromAccountId || !toAccountId) {
      setError('Выберите счета для перевода')
      return
    }

    if (!amountValidation.valid) {
      setError(amountValidation.message)
      return
    }

    const transferAmount = parseFloat(amount)
    
    // Показываем предпросмотр перед подтверждением
    if (!showPreview) {
      setShowPreview(true)
      return
    }

    setLoading(true)
    try {
      await onTransfer(fromAccountId, toAccountId, transferAmount, description)
      onClose()
    } catch (err: any) {
      console.error('Ошибка перевода:', err)
      const errorMessage = err?.message || err?.error || 'Не удалось выполнить перевод'
      setError(errorMessage)
      setShowPreview(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !showPreview) {
          onClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Перевод между счетами</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center space-x-2 animate-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Предпросмотр перевода */}
          {showPreview && fromAccountData && toAccountData && amount && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3 animate-in slide-in-from-top-2">
              <div className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-300">Подтверждение перевода</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Сумма перевода:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(parseFloat(amount), fromAccountData.currency)}</span>
                </div>
                {commission > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Комиссия:</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(commission, 'RUB')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-700">
                  <span className="text-gray-600 dark:text-gray-400">Итого списание:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(parseFloat(amount) + commission, fromAccountData.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Получит:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(parseFloat(amount), toAccountData.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Счет отправителя */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              С какого счета
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {internalAccounts.map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    if (!fromAccount) {
                      setFromAccountId(acc.id)
                      // Сбрасываем получателя, если он совпадает с отправителем
                      if (toAccountId === acc.id) {
                        setToAccountId('')
                      }
                    }
                  }}
                  disabled={!!fromAccount}
                  className={`w-full text-left p-3 rounded-lg border-2 transition ${
                    fromAccountId === acc.id
                      ? 'border-primary-600 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                  } ${fromAccount ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        fromAccountId === acc.id ? 'bg-primary-200 dark:bg-primary-800' : 'bg-primary-100 dark:bg-primary-900/50'
                      }`}>
                        <CreditCard className={`h-5 w-5 ${fromAccountId === acc.id ? 'text-primary-700 dark:text-primary-300' : 'text-primary-600 dark:text-primary-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{acc.bankName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">•••• {acc.accountNumber.slice(-4)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(acc.balance, acc.currency)}</p>
                      {fromAccountId === acc.id && (
                        <CheckCircle className="h-5 w-5 text-primary-600 dark:text-primary-400 ml-auto mt-1" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {fromAccountData && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">Доступно: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(fromAccountData.balance, fromAccountData.currency)}</span></p>
              </div>
            )}
          </div>

          {/* Стрелка */}
          <div className="flex justify-center py-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700">
              <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
          </div>

          {/* Счет получателя */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              На какой счет
            </label>
            {!toAccountId ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableAccounts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                    Нет доступных счетов
                  </div>
                ) : (
                  availableAccounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setToAccountId(acc.id)}
                      className="w-full text-left p-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500 bg-white dark:bg-gray-700 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="h-10 w-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CreditCard className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{acc.bankName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">•••• {acc.accountNumber.slice(-4)}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{formatCurrency(acc.balance, acc.currency)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="p-3 rounded-lg border-2 border-primary-600 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="h-10 w-10 bg-primary-200 dark:bg-primary-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CreditCard className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{toAccountData?.bankName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">•••• {toAccountData?.accountNumber.slice(-4)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setToAccountId('')}
                      className="p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800/50 rounded transition flex-shrink-0 ml-2"
                      aria-label="Отменить выбор"
                    >
                      <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                  {fromAccountData && toAccountData && fromAccountData.bankName !== toAccountData.bankName && (
                    <div className="mt-2 pt-2 border-t border-primary-200 dark:border-primary-700">
                      <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center space-x-1">
                        <Info className="h-3 w-3" />
                        <span>Перевод между банками (комиссия 1%)</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Сумма */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Сумма
              </label>
              {fromAccountData && quickAmounts.length > 0 && (
                <div className="flex items-center space-x-1">
                  {quickAmounts.map((quick, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickAmount(quick.value)}
                      className="px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition"
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value)
                  if (!isNaN(num) && num > 0) {
                    setAmount(num.toFixed(2))
                  }
                }}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg font-semibold dark:bg-gray-700 dark:text-white ${
                  amountValidation.valid
                    ? amount ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'
                    : 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                }`}
                placeholder="0.00"
                required
              />
              {amount && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{fromAccountData?.currency || 'RUB'}</span>
                </div>
              )}
            </div>
            {amount && (
              <div className="mt-2 space-y-2">
                {amountValidation.valid ? (
                  <div className="flex items-center space-x-1 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Сумма валидна</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>{amountValidation.message}</span>
                  </div>
                )}
                
                {fromAccountData && amount && amountValidation.valid && (
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Текущий баланс:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(fromAccountData.balance, fromAccountData.currency)}</span>
                    </div>
                    {commission > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Комиссия:</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400">-{formatCurrency(commission, fromAccountData.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Списание:</span>
                      <span className="font-medium text-gray-900 dark:text-white">-{formatCurrency(parseFloat(amount), fromAccountData.currency)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Останется:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(fromAccountData.balance - parseFloat(amount) - commission, fromAccountData.currency)}</span>
                    </div>
                  </div>
                )}
                
                {toAccountData && amount && amountValidation.valid && (
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Получит:</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(parseFloat(amount), toAccountData.currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Описание (необязательно)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Назначение перевода..."
              maxLength={100}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description.length}/100</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-3 pt-4">
            {showPreview && (
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm sm:text-base"
              >
                Назад
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm sm:text-base ${showPreview ? 'hidden sm:block' : ''}`}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !amountValidation.valid || !fromAccountId || !toAccountId || !amount}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Выполняется...</span>
                </>
              ) : showPreview ? (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Подтвердить перевод</span>
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  <span>Продолжить</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

