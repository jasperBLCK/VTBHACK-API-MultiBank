import { PrismaClient } from '@prisma/client'

// Используем singleton pattern для Prisma Client
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Демо userId - в реальном приложении это должно быть из сессии/токена
export const DEMO_USER_ID = 'demo-user-1'

// Инициализация демо пользователя
export async function ensureDemoUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: DEMO_USER_ID },
    })

    if (!user) {
      await prisma.user.create({
        data: {
          id: DEMO_USER_ID,
          email: 'demo@multibank.ru',
          name: 'Демо пользователь',
        },
      })
    }

    return DEMO_USER_ID
  } catch (error) {
    console.error('Ошибка инициализации демо пользователя:', error)
    throw error
  }
}

export default prisma

