/**
 * API клиент для работы с FastAPI банковским API
 * Адаптирует ответы OpenBanking Russia формата к внутреннему формату FrontendN
 */

import { BankAccount, Transaction } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8001')

// Интерфейсы для ответов FastAPI (OpenBanking Russia формат)
interface FastAPIAccount {
  accountId: string
  status: string
  currency: string
  accountType: string
  accountSubType: string
  nickname?: string
  openingDate: string
  account: Array<{
    schemeName: string
    identification: string
    name?: string
  }>
}

interface FastAPIBalance {
  accountId: string
  type: string
  dateTime: string
  amount: {
    amount: string
    currency: string
  }
  creditDebitIndicator: string
}

interface FastAPITransaction {
  transactionId: string
  accountId: string
  amount: {
    amount: string
    currency: string
  }
  creditDebitIndicator: string
  status: string
  bookingDateTime: string
  valueDateTime?: string
  remittanceInformation?: {
    unstructured?: string
    reference?: string
  }
  transactionInformation?: string
}

interface FastAPIAccountsResponse {
  data: {
    account: FastAPIAccount[]
  }
  links?: any
  meta?: any
}

interface FastAPIBalancesResponse {
  data: {
    balance: FastAPIBalance[]
  }
}

interface FastAPITransactionsResponse {
  data: {
    transaction: FastAPITransaction[]
  }
}

class BankApiClient {
  private baseUrl: string
  private accessToken: string | null = null

  constructor() {
    this.baseUrl = API_BASE_URL
    // Загружаем токен из localStorage при инициализации (только в браузере)
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token')
    }
  }

  setAccessToken(token: string) {
    this.accessToken = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token)
    }
  }

  clearAccessToken() {
    this.accessToken = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('client_id')
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      if (response.status === 401) {
        // Токен истек или невалиден
        this.clearAccessToken()
        throw new Error('Требуется авторизация')
      }
      const errorText = await response.text()
      let errorMessage = `Ошибка ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorJson.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  /**
   * Авторизация
   */
  async login(username: string, password: string): Promise<{ access_token: string; client_id: string }> {
    const response = await this.request<{ access_token: string; token_type: string; client_id: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    )
    
    this.setAccessToken(response.access_token)
    if (typeof window !== 'undefined') {
      localStorage.setItem('client_id', response.client_id)
    }
    
    return {
      access_token: response.access_token,
      client_id: response.client_id,
    }
  }

  /**
   * Получить информацию о текущем клиенте
   */
  async getMe(): Promise<any> {
    return this.request('/auth/me')
  }

  /**
   * Получить список счетов
   */
  async getAccounts(): Promise<BankAccount[]> {
    const response = await this.request<FastAPIAccountsResponse>('/accounts')
    
    return response.data.account.map((acc) => {
      // Извлекаем номер счета из account[0].identification
      const accountNumber = acc.account[0]?.identification || acc.accountId
      // Извлекаем название банка из конфига или используем дефолтное
      const bankName = acc.account[0]?.name || 'My Bank'
      
      return {
        id: acc.accountId,
        bankName,
        accountNumber,
        balance: 0, // Баланс будет загружен отдельно
        currency: acc.currency,
        type: acc.accountSubType.toLowerCase().includes('savings') 
          ? 'savings' 
          : acc.accountSubType.toLowerCase().includes('credit')
          ? 'credit'
          : 'debit',
      }
    })
  }

  /**
   * Получить баланс счета
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const response = await this.request<FastAPIBalancesResponse>(
      `/accounts/${accountId}/balances`
    )
    
    // Используем первый доступный баланс (InterimAvailable или InterimBooked)
    const balance = response.data.balance[0]
    if (!balance) {
      return 0
    }
    
    const amount = parseFloat(balance.amount.amount)
    // Если creditDebitIndicator = "Debit", баланс отрицательный
    return balance.creditDebitIndicator === 'Debit' ? -amount : amount
  }

  /**
   * Получить счета с балансами
   */
  async getAccountsWithBalances(): Promise<BankAccount[]> {
    const accounts = await this.getAccounts()
    
    // Загружаем балансы для каждого счета
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        try {
          const balance = await this.getAccountBalance(account.id)
          return {
            ...account,
            balance,
          }
        } catch (error) {
          console.error(`Ошибка загрузки баланса для счета ${account.id}:`, error)
          return {
            ...account,
            balance: 0,
          }
        }
      })
    )
    
    return accountsWithBalances
  }

  /**
   * Получить транзакции по счету
   */
  async getTransactions(
    accountId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<Transaction[]> {
    const params = new URLSearchParams()
    if (fromDate) {
      params.append('from_booking_date_time', fromDate.toISOString())
    }
    if (toDate) {
      params.append('to_booking_date_time', toDate.toISOString())
    }
    
    const queryString = params.toString()
    const endpoint = `/accounts/${accountId}/transactions${queryString ? `?${queryString}` : ''}`
    
    const response = await this.request<FastAPITransactionsResponse>(endpoint)
    
    return response.data.transaction.map((txn) => {
      const amount = parseFloat(txn.amount.amount)
      const isDebit = txn.creditDebitIndicator === 'Debit'
      const finalAmount = isDebit ? -amount : amount
      
      // Определяем тип транзакции
      let type: 'transfer' | 'payment' | 'income' = 'payment'
      if (finalAmount > 0) {
        type = 'income'
      } else if (txn.remittanceInformation?.reference?.includes('transfer')) {
        type = 'transfer'
      }
      
      // Определяем категорию на основе описания
      let category: Transaction['category'] = 'other'
      const description = txn.transactionInformation || txn.remittanceInformation?.unstructured || ''
      const descLower = description.toLowerCase()
      if (descLower.includes('еда') || descLower.includes('food') || descLower.includes('ресторан')) {
        category = 'food'
      } else if (descLower.includes('транспорт') || descLower.includes('transport') || descLower.includes('метро')) {
        category = 'transport'
      } else if (descLower.includes('покупк') || descLower.includes('shopping') || descLower.includes('магазин')) {
        category = 'shopping'
      } else if (descLower.includes('счет') || descLower.includes('bill') || descLower.includes('оплат')) {
        category = 'bills'
      } else if (finalAmount > 0) {
        category = 'income'
      }
      
      return {
        id: txn.transactionId,
        accountId: txn.accountId,
        amount: finalAmount,
        currency: txn.amount.currency,
        description: description || 'Транзакция',
        date: new Date(txn.bookingDateTime),
        category,
        type,
      }
    })
  }

  /**
   * Получить все транзакции по всем счетам
   */
  async getAllTransactions(fromDate?: Date, toDate?: Date): Promise<Transaction[]> {
    const accounts = await this.getAccounts()
    const allTransactions: Transaction[] = []
    
    for (const account of accounts) {
      try {
        const transactions = await this.getTransactions(account.id, fromDate, toDate)
        allTransactions.push(...transactions)
      } catch (error) {
        console.error(`Ошибка загрузки транзакций для счета ${account.id}:`, error)
      }
    }
    
    // Сортируем по дате (новые сначала)
    return allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime())
  }

  /**
   * Создать платеж/перевод
   */
  async createPayment(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    description?: string
  ): Promise<any> {
    // Преобразуем accountId в номер счета для платежа
    // Сначала получаем информацию о счетах
    const accounts = await this.getAccounts()
    const fromAccount = accounts.find((acc) => acc.id === fromAccountId)
    const toAccount = accounts.find((acc) => acc.id === toAccountId)
    
    if (!fromAccount || !toAccount) {
      throw new Error('Счета не найдены')
    }
    
    // Формируем запрос в формате OpenBanking Russia Payments API
    const paymentRequest = {
      data: {
        initiation: {
          instructionIdentification: `instr-${Date.now()}`,
          endToEndIdentification: `e2e-${Date.now()}`,
          instructedAmount: {
            amount: amount.toFixed(2),
            currency: fromAccount.currency,
          },
          debtorAccount: {
            schemeName: 'RU.CBR.PAN',
            identification: fromAccount.accountNumber,
            name: fromAccount.bankName,
          },
          creditorAccount: {
            schemeName: 'RU.CBR.PAN',
            identification: toAccount.accountNumber,
            name: toAccount.bankName,
          },
          remittanceInformation: {
            unstructured: description || 'Перевод',
          },
        },
      },
    }
    
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentRequest),
    })
  }

  /**
   * Проверить статус API
   */
  async healthCheck(): Promise<any> {
    return this.request('/health')
  }

  /**
   * Получить информацию о банке
   */
  async getBankInfo(): Promise<any> {
    return this.request('/')
  }
}

export const bankApiClient = new BankApiClient()
export default bankApiClient

