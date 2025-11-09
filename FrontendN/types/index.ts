export interface BankCard {
  cardId: string
  cardNumber: string // Маскированный номер типа "*3245"
  expiryDate?: string // "03/27"
  cardName?: string
  cardType?: string
  status?: string
  accountNumber?: string
}

export interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  balance: number
  currency: string
  type: 'debit' | 'credit' | 'savings'
  bankLogo?: string
  cards?: BankCard[]
}

export interface Transaction {
  id: string
  accountId: string
  amount: number
  currency: string
  description: string
  date: Date
  category: 'income' | 'shopping' | 'food' | 'transport' | 'bills' | 'other'
  merchantName?: string
  toAccountId?: string
  type?: 'transfer' | 'payment' | 'income'
}

export interface BankConnection {
  id: string
  bankName: string
  isConnected: boolean
  lastSync?: Date
}

export interface TransferRequest {
  fromAccountId: string
  toAccountId: string
  amount: number
  description?: string
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx'
  dateFrom?: Date
  dateTo?: Date
  accountIds?: string[]
}

export interface Budget {
  id: string
  category: string
  amount: number
  period: 'monthly' | 'yearly'
  startDate: Date
  endDate?: Date
  spent?: number
}

export interface BudgetAlert {
  id: string
  budgetId: string
  threshold: number // Процент от бюджета (например, 80%)
  triggered: boolean
}

export interface Forecast {
  category: string
  predictedAmount: number
  confidence: number // 0-1
  trend: 'up' | 'down' | 'stable'
  period: 'week' | 'month'
}
