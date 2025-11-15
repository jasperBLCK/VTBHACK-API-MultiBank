import { Transaction, BankAccount, ExportOptions } from '@/types'
import { formatDate, formatCurrency } from './format'

export async function exportTransactions(
  transactions: Transaction[],
  accounts: BankAccount[],
  options: ExportOptions
) {
  let filteredTransactions = transactions

  // Фильтрация по датам
  if (options.dateFrom) {
    filteredTransactions = filteredTransactions.filter(
      t => new Date(t.date) >= options.dateFrom!
    )
  }
  if (options.dateTo) {
    filteredTransactions = filteredTransactions.filter(
      t => new Date(t.date) <= options.dateTo!
    )
  }

  // Фильтрация по счетам
  if (options.accountIds && options.accountIds.length > 0) {
    filteredTransactions = filteredTransactions.filter(
      t => options.accountIds!.includes(t.accountId)
    )
  }

  // Сортировка по дате
  filteredTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  switch (options.format) {
    case 'csv':
      exportToCSV(filteredTransactions, accounts)
      break
    case 'json':
      exportToJSON(filteredTransactions, accounts)
      break
    case 'xlsx':
      await exportToXLSX(filteredTransactions, accounts)
      break
  }
}

function exportToCSV(transactions: Transaction[], accounts: BankAccount[]) {
  const headers = ['Дата', 'Банк', 'Счет', 'Сумма', 'Валюта', 'Описание', 'Категория']
  const rows = transactions.map(t => {
    const account = accounts.find(a => a.id === t.accountId)
    return [
      formatDate(t.date),
      account?.bankName || '',
      account?.accountNumber.slice(-4) || '',
      t.amount.toString(),
      t.currency,
      t.description,
      t.category,
    ]
  })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

function exportToJSON(transactions: Transaction[], accounts: BankAccount[]) {
  const data = {
    exportDate: new Date().toISOString(),
    transactions: transactions.map(t => ({
      ...t,
      date: t.date.toISOString(),
      account: accounts.find(a => a.id === t.accountId),
    })),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `transactions_${new Date().toISOString().split('T')[0]}.json`
  link.click()
}

async function exportToXLSX(transactions: Transaction[], accounts: BankAccount[]) {
  // Для XLSX используем простой CSV, так как для полноценного XLSX нужна библиотека
  // В продакшене можно использовать xlsx или exceljs
  exportToCSV(transactions, accounts)
}

