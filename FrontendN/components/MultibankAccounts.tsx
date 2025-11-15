'use client'

import { useState, useEffect, useRef } from 'react'
import { BankAccount } from '@/types'
import AccountCard from './AccountCard'
import { Building2, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

interface MultibankAccount extends BankAccount {
  bankCode: string
  bankUrl: string
  clientId?: string
}

interface MultibankAccountsProps {
  currentClientId: string
  onAccountsLoaded?: (accounts: MultibankAccount[]) => void
  onLoadRef?: (loadFn: () => void) => void
}

const BANKS = [
  {
    code: 'vbank',
    name: 'Virtual Bank',
    url: 'https://vbank.open.bankingapi.ru',
    color: '#667eea',
  },
  {
    code: 'abank',
    name: 'Awesome Bank',
    url: 'https://abank.open.bankingapi.ru',
    color: '#e74c3c',
  },
  {
    code: 'sbank',
    name: 'Smart Bank',
    url: 'https://sbank.open.bankingapi.ru',
    color: '#27ae60',
  },
]

// (removed permanent client_id handling - reverting to dynamic client_id probing)

export default function MultibankAccounts({ currentClientId, onAccountsLoaded, onLoadRef }: MultibankAccountsProps) {
  const [accounts, setAccounts] = useState<MultibankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingBanks, setLoadingBanks] = useState<Set<string>>(new Set())
  const bankTokenCache = useRef<Record<string, { token: string; expires: number }>>({})
  const lastLoadedRef = useRef<number | null>(null)

  // Генерация списка client_id для попытки (как в старом коде)
  const getClientIdsToTry = (clientId: string): string[] => {
    const clientIds: string[] = []

    if (clientId.startsWith('team251-')) {
      // Для team251 используем только team251-X клиентов (1-10)
      clientIds.push(clientId)
      for (let i = 1; i <= 10; i++) {
        const id = `team251-${i}`
        if (id !== clientId) {
          clientIds.push(id)
        }
      }
    } else if (clientId.startsWith('team')) {
      // Для других команд используем клиентов той же команды
      const teamPrefix = clientId.split('-')[0]
      clientIds.push(clientId)
      for (let i = 1; i <= 10; i++) {
        const id = `${teamPrefix}-${i}`
        if (id !== clientId) {
          clientIds.push(id)
        }
      }
    } else {
      // Для других клиентов используем только текущий
      clientIds.push(clientId)
    }

    return clientIds
  }

  const loadBankAccounts = async (bank: typeof BANKS[0]) => {
    // Prevent concurrent loads for the same bank
    if (loadingBanks.has(bank.code)) {
      console.log(`ℹ️ ${bank.name}: загрузка уже запущена, пропускаем`)
      return
    }
    setLoadingBanks(prev => new Set(prev).add(bank.code))
    setError(null)

    try {
      console.log(`🔄 ${bank.name}: начинаем загрузку счетов для ${currentClientId}...`)

      // ШАГ 1: Получить банковский токен (кэшируем на короткое время)
      let bankToken: string | null = null
      const cached = bankTokenCache.current[bank.code]
      if (cached && cached.expires > Date.now()) {
        bankToken = cached.token
        console.log(`✅ ${bank.name}: используем кэшированный банковский токен`)
      } else {
        const bankTokenResponse = await fetch('/api/multibank/bank-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_url: bank.url }),
      })

      if (!bankTokenResponse.ok) {
        const errorData = await bankTokenResponse.json().catch(() => ({}))
        console.error(`❌ ${bank.name}: не удалось получить банковский токен - прекращаем загрузку`)
        throw new Error(`Не удалось получить банковский токен от ${bank.name}: ${errorData.error || errorData.message || bankTokenResponse.statusText}`)
      }

        const bankTokenData = await bankTokenResponse.json()
  bankToken = bankTokenData.access_token
        // Сохраняем в кэш с истечением (если есть expires_in используем его)
        const expiresIn = bankTokenData.expires_in ? parseInt(bankTokenData.expires_in, 10) * 1000 : 5 * 60 * 1000
        bankTokenCache.current[bank.code] = {
          token: bankToken as string,
          expires: Date.now() + expiresIn,
        }
        console.log(`✅ ${bank.name}: получен банковский токен`)
      }

      // Ensure we have a valid token string before further requests
      if (!bankToken) {
        throw new Error(`Не удалось получить банковский токен от ${bank.name}`)
      }

      // ШАГ 2: Попробовать получить consent для разных client_id
      const clientIdsToTry = getClientIdsToTry(currentClientId)
      let consentId: string | null = null
      let workingClientId: string | null = null

      console.log(`🔍 ${bank.name}: пробуем получить consent для client_id: ${clientIdsToTry.slice(0, 5).join(', ')}...`)

      for (const clientIdToTry of clientIdsToTry) {
        try {
          const consentResponse = await fetch('/api/multibank/request-consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bank_url: bank.url,
              bank_token: bankToken,
              client_id: clientIdToTry,
            }),
          })

          if (consentResponse.ok) {
            const consentData = await consentResponse.json()
            consentId =
              consentData.Data?.ConsentId ||
              consentData.consent_id ||
              consentData.ConsentId ||
              consentData.id
            workingClientId = clientIdToTry
            console.log(`✅ ${bank.name}: получен consent для ${clientIdToTry}`)
            break
          } else {
            // Если ошибка получения согласия - прекращаем ВСЕ дальнейшие запросы для этого банка
            const errorData = await consentResponse.json().catch(() => ({}))
            const errorMsg = errorData.error || errorData.message || errorData.detail || consentResponse.statusText || 'Ошибка получения согласия'
            console.error(`❌ ${bank.name}: не удалось получить согласие для ${clientIdToTry}: ${errorMsg}`)
            console.error(`❌ ${bank.name}: прекращаем все дальнейшие запросы (accounts, cards, balances) для этого банка`)
            // НЕ продолжаем попытки для других client_id - сразу прекращаем ВСЕ запросы
            throw new Error(`Не удалось получить согласие: ${errorMsg}`)
          }
        } catch (e: any) {
          // Если это наша ошибка о согласии - пробрасываем дальше
          if (e.message && e.message.includes('Не удалось получить согласие')) {
            throw e
          }
          console.warn(`⚠️ ${bank.name}: ошибка при запросе consent для ${clientIdToTry}:`, e)
          // Продолжаем попытки только если это сетевая ошибка, а не ошибка согласия
          continue
        }
      }

      if (!consentId || !workingClientId) {
        // Если не получили согласие - прекращаем все дальнейшие запросы для этого банка
        console.error(`❌ ${bank.name}: не удалось получить согласие ни для одного клиента - прекращаем загрузку`)
        throw new Error(`Не удалось получить согласие ни для одного клиента`)
      }

      // ШАГ 3: Получить счета
      const accountsResponse = await fetch('/api/multibank/accounts-with-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_url: bank.url,
          bank_token: bankToken,
          consent_id: consentId,
          client_id: workingClientId,
        }),
      })

      if (!accountsResponse.ok) {
        const errorData = await accountsResponse.json()
        if (errorData.error?.includes('CONSENT_REQUIRED')) {
          throw new Error(`Требуется авторизация согласия на доступ к счетам`)
        }
        throw new Error(errorData.error || 'Ошибка получения счетов')
      }

      const accountsData = await accountsResponse.json()
      console.log(`✅ ${bank.name}: получено ${accountsData.data?.account?.length || 0} счетов`)

      // ШАГ 4: Получить карты клиента
      let cards: any[] = []
      try {
        const cardsResponse = await fetch('/api/multibank/cards-with-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bank_url: bank.url,
            bank_token: bankToken,
            consent_id: consentId,
            client_id: workingClientId,
          }),
        })

        if (cardsResponse.ok) {
          const cardsData = await cardsResponse.json()
          cards = cardsData.data?.card || []
          console.log(`✅ ${bank.name}: получено ${cards.length} карт`)
        }
      } catch (e) {
        console.warn(`⚠️ Не удалось получить карты из ${bank.name}:`, e)
      }

      // ШАГ 5: Получить балансы для каждого счета и привязать карты
      const bankAccounts: MultibankAccount[] = []

      for (const account of accountsData.data?.account || []) {
        try {
          const balanceResponse = await fetch(
            `/api/multibank/balances-with-consent?account_id=${encodeURIComponent(account.accountId)}&bank_url=${encodeURIComponent(bank.url)}&bank_token=${encodeURIComponent(bankToken)}&consent_id=${encodeURIComponent(consentId)}`,
            { method: 'POST' }
          )

          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json()
            const balance = parseFloat(balanceData.data?.balance?.[0]?.amount?.amount || '0')
            const accountNumber = account.account?.[0]?.identification || account.accountId

            // Находим карты, привязанные к этому счету
            const accountCards = cards
              .filter((card: any) => {
                // Проверяем привязку карты к счету
                const cardAccountNumber = card.account_number || card.accountNumber
                return cardAccountNumber === accountNumber || cardAccountNumber === account.accountId
              })
              .map((card: any) => {
                // Форматируем данные карты
                let cardNumber = card.card_number || card.cardNumber || ''
                let expiryDate = card.expiry_date || card.expiryDate || ''
                const cardAccountNumber = card.account_number || card.accountNumber
                
                // Если номер карты в формате полного номера, маскируем его
                if (cardNumber && cardNumber.length > 4 && !cardNumber.startsWith('*')) {
                  cardNumber = `*${cardNumber.slice(-4)}`
                }
                
                // Форматируем дату истечения (если есть)
                if (expiryDate && !expiryDate.includes('/')) {
                  // Если дата в формате YYYY-MM или YYYY-MM-DD, преобразуем в MM/YY
                  const dateMatch = expiryDate.match(/(\d{4})-(\d{2})/)
                  if (dateMatch) {
                    expiryDate = `${dateMatch[2]}/${dateMatch[1].slice(-2)}`
                  }
                }

                return {
                  cardId: card.card_id || card.cardId || card.id,
                  cardNumber,
                  expiryDate,
                  cardName: card.card_name || card.cardName || 'Банковская карта',
                  cardType: card.card_type || card.cardType || 'debit',
                  status: card.status || 'active',
                  accountNumber: cardAccountNumber,
                }
              })

            bankAccounts.push({
              id: account.accountId,
              bankName: bank.name,
              accountNumber,
              balance,
              currency: account.currency || 'RUB',
              type: account.accountSubType?.toLowerCase().includes('savings')
                ? 'savings'
                : account.accountSubType?.toLowerCase().includes('credit')
                ? 'credit'
                : 'debit',
              bankCode: bank.code,
              bankUrl: bank.url,
              clientId: workingClientId,
              cards: accountCards.length > 0 ? accountCards : undefined,
              // Сохраняем данные для загрузки транзакций
              metadata: {
                bankToken,
                consentId,
                bankUrl: bank.url,
              },
            } as any)
          }
        } catch (e) {
          console.warn(`⚠️ Не удалось получить баланс для счета ${account.accountId}:`, e)
        }
      }

      setAccounts(prev => {
        // Удаляем старые счета этого банка
        const filtered = prev.filter(acc => acc.bankCode !== bank.code)
        // Добавляем новые
        const updated = [...filtered, ...bankAccounts]
        
        // Уведомляем родительский компонент
        if (onAccountsLoaded) {
          onAccountsLoaded(updated)
        }
        
        return updated
      })
    } catch (error: any) {
      console.error(`❌ ${bank.name}: ошибка:`, error)
      setError(error.message || `Ошибка загрузки счетов из ${bank.name}`)
    } finally {
      setLoadingBanks(prev => {
        const next = new Set(prev)
        next.delete(bank.code)
        return next
      })
    }
  }

  const loadAllBanks = async () => {
    // Avoid frequent reloads and concurrent runs
    if (loading || loadingBanks.size > 0) {
      console.log('ℹ️ Multibank: загрузка уже выполняется, пропускаем')
      return
    }
    if (lastLoadedRef.current && Date.now() - lastLoadedRef.current < 60 * 1000) {
      console.log('ℹ️ Multibank: недавно загружали, пропускаем (throttle)')
      return
    }
    setLoading(true)
    setError(null)
    // Не очищаем счета сразу - показываем старые пока загружаются новые
    // setAccounts([])

    // Загружаем счета из всех банков параллельно
    await Promise.all(BANKS.map(bank => loadBankAccounts(bank)))
    lastLoadedRef.current = Date.now()
    setLoading(false)
  }

  // Передаем функцию загрузки родительскому компоненту
  useEffect(() => {
    if (onLoadRef) {
      onLoadRef(loadAllBanks)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoadRef, currentClientId])
  
  // Не загружаем автоматически при монтировании - только по запросу

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
  const isLoading = loading || loadingBanks.size > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Cards / Accounts
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Connect to external banks via OpenBanking API
          </p>
        </div>
        <button
          onClick={loadAllBanks}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Обновить</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Ошибка загрузки</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {isLoading && accounts.length === 0 && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400">Загрузка счетов из других банков...</p>
        </div>
      )}

      {totalBalance > 0 && (
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white p-6 rounded-lg">
          <div className="text-sm opacity-90 mb-1">Всего во всех банках</div>
          <div className="text-3xl font-bold">{totalBalance.toLocaleString('ru-RU')} ₽</div>
          <div className="text-sm opacity-80 mt-2">
            Счетов: {accounts.length} • Банков: {new Set(accounts.map(a => a.bankCode)).size}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {BANKS.map(bank => {
          const bankAccounts = accounts.filter(acc => acc.bankCode === bank.code)
          const isLoadingBank = loadingBanks.has(bank.code)

          return (
            <div key={bank.code} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: bank.color }}
                  />
                  {bank.name}
                </h4>
                {isLoadingBank && <Loader2 className="h-4 w-4 animate-spin text-primary-600" />}
              </div>

              {bankAccounts.length > 0 ? (
                <div className="space-y-2">
                  {bankAccounts.map(account => (
                    <div
                      key={account.id}
                      className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {account.accountNumber}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {account.type === 'savings' ? 'Накопительный' : account.type === 'credit' ? 'Кредитный' : 'Текущий'} счет
                            {account.clientId && (
                              <span className="ml-2 opacity-75">• {account.clientId}</span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {account.balance.toLocaleString('ru-RU')} ₽
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {account.currency}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : isLoadingBank ? (
                <div className="text-center py-4 text-gray-600 dark:text-gray-400 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Загрузка...
                </div>
              ) : (
                <button
                  onClick={() => loadBankAccounts(bank)}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50 text-sm"
                >
                  🏦 Загрузить счета из {bank.name}
                </button>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}

