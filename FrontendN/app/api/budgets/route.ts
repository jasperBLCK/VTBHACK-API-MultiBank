import { NextRequest, NextResponse } from 'next/server'
import { startOfMonth, endOfMonth } from 'date-fns'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    // Временное решение: возвращаем демо бюджеты
    const demoBudgets = [
      {
        id: '1',
        category: 'food',
        amount: 30000,
        period: 'monthly',
        startDate: startOfMonth(new Date()).toISOString(),
        endDate: endOfMonth(new Date()).toISOString(),
      },
      {
        id: '2',
        category: 'transport',
        amount: 5000,
        period: 'monthly',
        startDate: startOfMonth(new Date()).toISOString(),
        endDate: endOfMonth(new Date()).toISOString(),
      },
      {
        id: '3',
        category: 'entertainment',
        amount: 10000,
        period: 'monthly',
        startDate: startOfMonth(new Date()).toISOString(),
        endDate: endOfMonth(new Date()).toISOString(),
      },
    ]

    return NextResponse.json(demoBudgets)
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
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    const data = await request.json()

    const startDate = data.startDate ? new Date(data.startDate) : startOfMonth(new Date())
    const endDate = data.period === 'yearly' 
      ? endOfMonth(new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1)))
      : endOfMonth(startDate)

    const newBudget = {
      id: Date.now().toString(),
      category: data.category,
      amount: data.amount,
      period: data.period || 'monthly',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }

    return NextResponse.json(newBudget)
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
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID бюджета не указан' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления бюджета:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления бюджета' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
