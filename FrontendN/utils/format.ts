export function formatCurrency(amount: number, currency: string = 'RUB'): string {
  const formatter = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  
  return formatter.format(Math.abs(amount))
}

export function formatDate(date: Date | string): string {
  // Преобразуем строку в Date, если необходимо
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Неверная дата'
  }
  
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - dateObj.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Сегодня'
  } else if (diffDays === 1) {
    return 'Вчера'
  } else if (diffDays < 7) {
    return `${diffDays} дня назад`
  } else {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(dateObj)
  }
}

export function formatAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber
  return '•'.repeat(accountNumber.length - 4) + accountNumber.slice(-4)
}

