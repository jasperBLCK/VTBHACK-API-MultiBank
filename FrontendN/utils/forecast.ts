// Утилиты для прогнозирования доходов и расходов

import { Transaction, Forecast } from '@/types'
import { startOfMonth, endOfMonth, subMonths, differenceInDays, addDays } from 'date-fns'

/**
 * Прогнозирование расходов/доходов на основе исторических данных
 */
export function forecastTransactions(
  transactions: Transaction[],
  category: string,
  period: 'week' | 'month' = 'month'
): Forecast {
  const now = new Date()
  const monthsToAnalyze = 3 // Анализируем последние 3 месяца
  
  // Фильтруем транзакции по категории
  const categoryTransactions = transactions.filter(t => 
    t.category === category && 
    t.amount < 0 // Только расходы для прогноза
  )
  
  if (categoryTransactions.length === 0) {
    return {
      category,
      predictedAmount: 0,
      confidence: 0,
      trend: 'stable',
      period,
    }
  }

  // Группируем по месяцам
  const monthlyTotals: number[] = []
  for (let i = monthsToAnalyze - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))
    
    const monthTransactions = categoryTransactions.filter(t => {
      const date = new Date(t.date)
      return date >= monthStart && date <= monthEnd
    })
    
    const total = Math.abs(monthTransactions.reduce((sum, t) => sum + t.amount, 0))
    monthlyTotals.push(total)
  }

  // Вычисляем среднее значение
  const average = monthlyTotals.reduce((sum, val) => sum + val, 0) / monthlyTotals.length
  
  // Определяем тренд
  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (monthlyTotals.length >= 2) {
    const recent = monthlyTotals[monthlyTotals.length - 1]
    const previous = monthlyTotals[monthlyTotals.length - 2]
    const change = ((recent - previous) / previous) * 100
    
    if (change > 10) {
      trend = 'up'
    } else if (change < -10) {
      trend = 'down'
    }
  }

  // Вычисляем уверенность (на основе количества данных и стабильности)
  const variance = calculateVariance(monthlyTotals)
  const mean = monthlyTotals.reduce((sum, val) => sum + val, 0) / monthlyTotals.length
  const coefficientOfVariation = variance > 0 ? Math.sqrt(variance) / mean : 0
  const confidence = Math.max(0, Math.min(1, 1 - coefficientOfVariation)) // Чем меньше вариация, тем выше уверенность

  // Прогноз для периода
  let predictedAmount = average
  if (period === 'week') {
    predictedAmount = average / 4.33 // Среднее количество недель в месяце
  }

  return {
    category,
    predictedAmount: Math.round(predictedAmount),
    confidence: Math.round(confidence * 100) / 100,
    trend,
    period,
  }
}

/**
 * Прогноз общего баланса на конец месяца
 */
export function forecastBalance(
  currentBalance: number,
  transactions: Transaction[],
  period: 'week' | 'month' = 'month'
): number {
  const now = new Date()
  const periodStart = period === 'month' ? startOfMonth(now) : now
  const periodEnd = period === 'month' ? endOfMonth(now) : addDays(now, 7)
  
  // Прогнозируем расходы по категориям
  const categories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'other']
  let predictedExpenses = 0
  
  categories.forEach(category => {
    const forecast = forecastTransactions(transactions, category, period)
    predictedExpenses += forecast.predictedAmount
  })
  
  // Прогнозируем доходы
  const incomeTransactions = transactions.filter(t => t.amount > 0)
  const monthlyIncome = incomeTransactions.length > 0
    ? incomeTransactions.reduce((sum, t) => sum + t.amount, 0) / Math.max(1, incomeTransactions.length)
    : 0
  
  const predictedIncome = period === 'month' ? monthlyIncome : monthlyIncome / 4.33
  
  // Прогноз баланса
  const predictedBalance = currentBalance + predictedIncome - predictedExpenses
  
  return Math.round(predictedBalance)
}

/**
 * Вычисление дисперсии
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Прогноз для всех категорий
 */
export function forecastAllCategories(
  transactions: Transaction[],
  period: 'week' | 'month' = 'month'
): Forecast[] {
  const categories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'other']
  return categories.map(category => forecastTransactions(transactions, category, period))
}

