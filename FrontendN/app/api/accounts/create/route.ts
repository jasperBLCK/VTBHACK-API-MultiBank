import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

// Явный экспорт POST метода для Next.js App Router
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountName, currency, balance } = body

    // Получаем токен
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    // Отправляем запрос на бэкенд
    const response = await fetch(`${API_BASE_URL}/accounts/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        account_name: accountName,
        currency: currency || 'RUB',
        balance: balance || 0,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || 'Ошибка создания счета' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// Явно запрещаем другие методы
export const dynamic = 'force-dynamic'

