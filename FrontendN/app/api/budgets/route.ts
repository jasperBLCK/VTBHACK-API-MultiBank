import { NextRequest, NextResponse } from 'next/server'
import prisma, { ensureDemoUser, DEMO_USER_ID } from '@/lib/db-utils'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  try {
    await ensureDemoUser()
    
    const budgets = await prisma.budget.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(budgets.map(b => ({
      id: b.id,
      category: b.category,
      amount: b.amount,
      period: b.period,
      startDate: b.startDate.toISOString(), // Возвращаем как ISO строку
      endDate: b.endDate ? b.endDate.toISOString() : undefined,
    })))
  } catch (error) {
    console.error('Ошибка загрузки бюджетов:', error)
    return NextResponse.json(
      { error: 'Ошибка загрузки бюджетов' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDemoUser()
    const data = await request.json()

    const startDate = data.startDate ? new Date(data.startDate) : startOfMonth(new Date())
    const endDate = data.period === 'yearly' 
      ? endOfMonth(new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1)))
      : endOfMonth(startDate)

    const budget = await prisma.budget.create({
      data: {
        userId: DEMO_USER_ID,
        category: data.category,
        amount: data.amount,
        period: data.period || 'monthly',
        startDate,
        endDate,
      },
    })

    return NextResponse.json({
      id: budget.id,
      category: budget.category,
      amount: budget.amount,
      period: budget.period,
      startDate: budget.startDate.toISOString(), // Возвращаем как ISO строку
      endDate: budget.endDate ? budget.endDate.toISOString() : undefined,
    })
  } catch (error) {
    console.error('Ошибка создания бюджета:', error)
    return NextResponse.json(
      { error: 'Ошибка создания бюджета' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDemoUser()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID бюджета не указан' },
        { status: 400 }
      )
    }

    await prisma.budget.delete({
      where: { id, userId: DEMO_USER_ID },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления бюджета:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления бюджета' },
      { status: 500 }
    )
  }
}

