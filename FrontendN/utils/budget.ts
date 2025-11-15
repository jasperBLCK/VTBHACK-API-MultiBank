// Утилиты для работы с бюджетом

import { Budget, Transaction, BudgetAlert } from '@/types'
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

/**
 * Вычисление потраченной суммы по категории за период
 */
export function calculateSpent(
  budget: Budget,
  transactions: Transaction[]
): number {
  const periodStart = startOfMonth(new Date(budget.startDate))
  const periodEnd = budget.endDate 
    ? endOfMonth(new Date(budget.endDate))
    : endOfMonth(new Date())

  const categoryTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date)
    return (
      t.category === budget.category &&
      t.amount < 0 && // Только расходы
      isWithinInterval(transactionDate, { start: periodStart, end: periodEnd })
    )
  })

  return Math.abs(categoryTransactions.reduce((sum, t) => sum + t.amount, 0))
}

/**
 * Вычисление процента использования бюджета
 */
export function calculateBudgetUsage(budget: Budget, transactions: Transaction[]): number {
  const spent = calculateSpent(budget, transactions)
  return budget.amount > 0 ? (spent / budget.amount) * 100 : 0
}

/**
 * Проверка превышения бюджета
 */
export function isBudgetExceeded(budget: Budget, transactions: Transaction[]): boolean {
  const usage = calculateBudgetUsage(budget, transactions)
  return usage > 100
}

/**
 * Проверка срабатывания предупреждений
 */
export function checkBudgetAlerts(
  budget: Budget,
  alerts: BudgetAlert[],
  transactions: Transaction[]
): BudgetAlert[] {
  const usage = calculateBudgetUsage(budget, transactions)
  
  return alerts.map(alert => {
    if (usage >= alert.threshold && !alert.triggered) {
      return {
        ...alert,
        triggered: true,
      }
    }
    return alert
  })
}

/**
 * Получение оставшейся суммы бюджета
 */
export function getRemainingBudget(budget: Budget, transactions: Transaction[]): number {
  const spent = calculateSpent(budget, transactions)
  return Math.max(0, budget.amount - spent)
}

/**
 * Прогноз превышения бюджета
 */
export function willExceedBudget(
  budget: Budget,
  transactions: Transaction[],
  daysRemaining: number
): boolean {
  const spent = calculateSpent(budget, transactions)
  const totalDays = budget.period === 'monthly' ? 30 : 365
  const daysElapsed = totalDays - daysRemaining
  const dailyAverage = daysElapsed > 0 ? spent / daysElapsed : 0
  const projectedSpending = spent + (dailyAverage * daysRemaining)
  
  return projectedSpending > budget.amount
}

