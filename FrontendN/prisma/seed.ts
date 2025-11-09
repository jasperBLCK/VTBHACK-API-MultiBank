import { PrismaClient } from '@prisma/client'
import { startOfMonth } from 'date-fns'

const prisma = new PrismaClient()

const DEMO_USER_ID = 'demo-user-1'

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...')

  // Создаем демо пользователя
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: 'demo@multibank.ru',
      name: 'Демо пользователь',
    },
  })
  console.log('✅ Пользователь создан:', user.email)

  // Создаем счета
  const account1 = await prisma.account.upsert({
    where: { id: 'account-1' },
    update: {},
    create: {
      id: 'account-1',
      userId: DEMO_USER_ID,
      bankName: 'ВТБ',
      accountNumber: '40817810099910004312',
      balance: 125000.50,
      currency: 'RUB',
      type: 'debit',
    },
  })

  const account2 = await prisma.account.upsert({
    where: { id: 'account-2' },
    update: {},
    create: {
      id: 'account-2',
      userId: DEMO_USER_ID,
      bankName: 'Сбербанк',
      accountNumber: '40817810099910004313',
      balance: 50000.00,
      currency: 'RUB',
      type: 'debit',
    },
  })
  console.log('✅ Счета созданы')

  // Создаем транзакции
  const transactions = [
    {
      id: 'txn-1',
      userId: DEMO_USER_ID,
      accountId: account1.id,
      amount: -5000,
      currency: 'RUB',
      description: 'Покупка в магазине',
      date: new Date('2024-11-15'),
      category: 'shopping',
      type: 'payment',
    },
    {
      id: 'txn-2',
      userId: DEMO_USER_ID,
      accountId: account1.id,
      amount: 30000,
      currency: 'RUB',
      description: 'Зарплата',
      date: new Date('2024-11-10'),
      category: 'income',
      type: 'income',
    },
    {
      id: 'txn-3',
      userId: DEMO_USER_ID,
      accountId: account1.id,
      amount: -1500,
      currency: 'RUB',
      description: 'Продукты в магазине',
      date: new Date(),
      category: 'food',
      type: 'payment',
    },
    {
      id: 'txn-4',
      userId: DEMO_USER_ID,
      accountId: account1.id,
      amount: -500,
      currency: 'RUB',
      description: 'Такси',
      date: new Date(),
      category: 'transport',
      type: 'payment',
    },
  ]

  for (const txn of transactions) {
    await prisma.transaction.upsert({
      where: { id: txn.id },
      update: {},
      create: txn,
    })
  }
  console.log('✅ Транзакции созданы')

  // Создаем бюджеты
  const budgets = [
    {
      id: 'budget-1',
      userId: DEMO_USER_ID,
      category: 'food',
      amount: 30000,
      period: 'monthly',
      startDate: startOfMonth(new Date()),
    },
    {
      id: 'budget-2',
      userId: DEMO_USER_ID,
      category: 'transport',
      amount: 10000,
      period: 'monthly',
      startDate: startOfMonth(new Date()),
    },
    {
      id: 'budget-3',
      userId: DEMO_USER_ID,
      category: 'shopping',
      amount: 20000,
      period: 'monthly',
      startDate: startOfMonth(new Date()),
    },
    {
      id: 'budget-4',
      userId: DEMO_USER_ID,
      category: 'bills',
      amount: 25000,
      period: 'monthly',
      startDate: startOfMonth(new Date()),
    },
  ]

  for (const budget of budgets) {
    await prisma.budget.upsert({
      where: { id: budget.id },
      update: {},
      create: budget,
    })
  }
  console.log('✅ Бюджеты созданы')

  console.log('🎉 База данных успешно заполнена!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка заполнения базы данных:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

