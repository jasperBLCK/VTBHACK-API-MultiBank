import { NextRequest, NextResponse } from 'next/server'
import prisma, { ensureDemoUser, DEMO_USER_ID } from '@/lib/db-utils'

export async function GET() {
  try {
    await ensureDemoUser()
    
    const connections = await prisma.bankConnection.findMany({
      where: { userId: DEMO_USER_ID, isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(connections.map(c => ({
      id: c.id,
      bankId: c.bankId,
      bankName: c.bankName,
      isActive: c.isActive,
      lastSyncedAt: c.createdAt.toISOString(), // Используем createdAt как lastSyncedAt
      createdAt: c.createdAt.toISOString(),
    })))
  } catch (error) {
    console.error('Ошибка загрузки подключений банков:', error)
    return NextResponse.json(
      { error: 'Ошибка загрузки подключений банков' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDemoUser()
    const data = await request.json()

    // Проверяем, существует ли уже подключение к этому банку
    // Используем findFirst, так как может быть несколько записей (активных/неактивных)
    const existingConnection = await prisma.bankConnection.findFirst({
      where: {
        userId: DEMO_USER_ID,
        bankId: data.bankId,
      },
      include: {
        accounts: true,
      },
    })

    // Если подключение уже существует и активно, возвращаем ошибку
    if (existingConnection && existingConnection.isActive) {
      return NextResponse.json(
        { error: 'Банк уже подключен' },
        { status: 400 }
      )
    }

    // Создаем подключение и счет в одной транзакции
    const result = await prisma.$transaction(async (tx) => {
      let connection

      if (existingConnection && !existingConnection.isActive) {
        // Если подключение существует, но неактивно - активируем его
        connection = await tx.bankConnection.update({
          where: { id: existingConnection.id },
          data: {
            isActive: true,
            accessToken: 'demo-token-' + Date.now(), // Обновляем токен
            updatedAt: new Date(),
          },
        })

        // Если у этого подключения уже есть счета, ничего не делаем
        // Если счетов нет, создаем новый
        if (existingConnection.accounts.length === 0) {
          const accountNumber = generateAccountNumber()
          const demoBalance = Math.floor(Math.random() * 190000) + 10000

          await tx.account.create({
            data: {
              userId: DEMO_USER_ID,
              bankConnectionId: connection.id,
              bankName: data.bankName,
              accountNumber: accountNumber,
              balance: demoBalance,
              currency: 'RUB',
              type: 'debit',
            },
          })
        }
      } else {
        // Создаем новое подключение к банку
        connection = await tx.bankConnection.create({
          data: {
            userId: DEMO_USER_ID,
            bankName: data.bankName,
            bankId: data.bankId,
            accessToken: 'demo-token-' + Date.now(), // Демо токен
            isActive: true,
          },
        })

        // Генерируем номер счета (для демо)
        const accountNumber = generateAccountNumber()

        // Создаем счет для этого банка
        // Для демо используем случайный баланс от 10000 до 200000
        const demoBalance = Math.floor(Math.random() * 190000) + 10000

        await tx.account.create({
          data: {
            userId: DEMO_USER_ID,
            bankConnectionId: connection.id,
            bankName: data.bankName,
            accountNumber: accountNumber,
            balance: demoBalance,
            currency: 'RUB',
            type: 'debit',
          },
        })
      }

      return connection
    })

    return NextResponse.json({
      id: result.id,
      bankId: result.bankId,
      bankName: result.bankName,
      isActive: result.isActive,
      lastSyncedAt: result.createdAt.toISOString(),
      createdAt: result.createdAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Ошибка создания подключения банка:', error)
    
    // Если ошибка из-за уникального ограничения
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Банк уже подключен' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Ошибка создания подключения банка' },
      { status: 500 }
    )
  }
}

// Функция для генерации номера счета (для демо)
function generateAccountNumber(): string {
  // Генерируем 20-значный номер счета в формате российского банковского счета
  const prefix = '40817' // Типичный префикс для расчетных счетов
  const randomPart = Math.floor(Math.random() * 10000000000000).toString().padStart(14, '0')
  return prefix + randomPart
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDemoUser()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID подключения не указан' },
        { status: 400 }
      )
    }

    // Деактивируем подключение и удаляем связанные счета в одной транзакции
    await prisma.$transaction(async (tx) => {
      // Деактивируем подключение
      await tx.bankConnection.update({
        where: { id, userId: DEMO_USER_ID },
        data: { isActive: false },
      })

      // Удаляем все счета, связанные с этим подключением
      await tx.account.deleteMany({
        where: { 
          bankConnectionId: id,
          userId: DEMO_USER_ID,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления подключения банка:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления подключения банка' },
      { status: 500 }
    )
  }
}

