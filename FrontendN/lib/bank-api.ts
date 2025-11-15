import axios from 'axios'
import { BankAccount, Transaction } from '@/types'

// Базовый интерфейс для банковских API
interface BankApiClient {
  getAccounts(): Promise<BankAccount[]>
  getTransactions(accountId: string, fromDate?: Date, toDate?: Date): Promise<Transaction[]>
  getBalance(accountId: string): Promise<number>
  transfer(fromAccountId: string, toAccountId: string, amount: number, description?: string): Promise<boolean>
}

// ВТБ API Client
class VTBApiClient implements BankApiClient {
  private apiUrl: string
  private clientId?: string
  private clientSecret?: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_VTB_API_URL || 'https://api.vtb.ru'
    this.clientId = process.env.NEXT_PUBLIC_VTB_CLIENT_ID
    this.clientSecret = process.env.NEXT_PUBLIC_VTB_CLIENT_SECRET
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }
      )

      this.accessToken = response.data.access_token
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000
      return this.accessToken
    } catch (error) {
      console.error('Ошибка получения токена ВТБ:', error)
      throw error
    }
  }

  async getAccounts(): Promise<BankAccount[]> {
    try {
      const token = await this.getAccessToken()
      const response = await axios.get(`${this.apiUrl}/api/v1/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      return response.data.map((acc: any) => ({
        id: acc.id,
        bankName: 'ВТБ',
        accountNumber: acc.accountNumber,
        balance: acc.balance,
        currency: acc.currency || 'RUB',
        type: acc.type || 'debit',
      }))
    } catch (error) {
      console.error('Ошибка получения счетов ВТБ:', error)
      return []
    }
  }

  async getTransactions(accountId: string, fromDate?: Date, toDate?: Date): Promise<Transaction[]> {
    try {
      const token = await this.getAccessToken()
      const params: any = {}
      if (fromDate) params.from = fromDate.toISOString()
      if (toDate) params.to = toDate.toISOString()

      const response = await axios.get(
        `${this.apiUrl}/api/v1/accounts/${accountId}/transactions`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      )
      
      return response.data.map((t: any) => ({
        id: t.id,
        accountId: t.accountId,
        amount: t.amount,
        currency: t.currency || 'RUB',
        description: t.description,
        date: new Date(t.date),
        category: t.category || 'other',
      }))
    } catch (error) {
      console.error('Ошибка получения транзакций ВТБ:', error)
      return []
    }
  }

  async getBalance(accountId: string): Promise<number> {
    try {
      const token = await this.getAccessToken()
      const response = await axios.get(
        `${this.apiUrl}/api/v1/accounts/${accountId}/balance`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      return response.data.balance
    } catch (error) {
      console.error('Ошибка получения баланса ВТБ:', error)
      return 0
    }
  }

  async transfer(fromAccountId: string, toAccountId: string, amount: number, description?: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken()
      await axios.post(
        `${this.apiUrl}/api/v1/transfers`,
        {
          fromAccountId,
          toAccountId,
          amount,
          description,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      return true
    } catch (error) {
      console.error('Ошибка перевода ВТБ:', error)
      return false
    }
  }
}

// Сбербанк API Client (заглушка для примера)
class SberbankApiClient implements BankApiClient {
  async getAccounts(): Promise<BankAccount[]> {
    // Здесь будет интеграция с API Сбербанка
    return []
  }

  async getTransactions(accountId: string, fromDate?: Date, toDate?: Date): Promise<Transaction[]> {
    return []
  }

  async getBalance(accountId: string): Promise<number> {
    return 0
  }

  async transfer(fromAccountId: string, toAccountId: string, amount: number, description?: string): Promise<boolean> {
    return false
  }
}

// Альфа-Банк API Client (заглушка для примера)
class AlfaBankApiClient implements BankApiClient {
  async getAccounts(): Promise<BankAccount[]> {
    // Здесь будет интеграция с API Альфа-Банка
    return []
  }

  async getTransactions(accountId: string, fromDate?: Date, toDate?: Date): Promise<Transaction[]> {
    return []
  }

  async getBalance(accountId: string): Promise<number> {
    return 0
  }

  async transfer(fromAccountId: string, toAccountId: string, amount: number, description?: string): Promise<boolean> {
    return false
  }
}

// Менеджер банковских API
export class BankApiManager {
  private clients: Map<string, BankApiClient> = new Map()

  constructor() {
    this.clients.set('vtb', new VTBApiClient())
    this.clients.set('sberbank', new SberbankApiClient())
    this.clients.set('alfabank', new AlfaBankApiClient())
  }

  getClient(bankName: string): BankApiClient | undefined {
    const key = bankName.toLowerCase().replace(/\s+/g, '')
    return this.clients.get(key)
  }

  async getAllAccounts(): Promise<BankAccount[]> {
    const allAccounts: BankAccount[] = []
    
    for (const [bankName, client] of this.clients.entries()) {
      try {
        const accounts = await client.getAccounts()
        allAccounts.push(...accounts)
      } catch (error) {
        console.error(`Ошибка загрузки счетов ${bankName}:`, error)
      }
    }
    
    return allAccounts
  }
}

export const bankApiManager = new BankApiManager()

