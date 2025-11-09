import { NextRequest, NextResponse } from 'next/server'
import { vtbApi } from '@/lib/vtb-api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId обязателен' },
        { status: 400 }
      )
    }

    const from = fromDate ? new Date(fromDate) : undefined
    const to = toDate ? new Date(toDate) : undefined

    const transactions = await vtbApi.getTransactions(accountId, from, to)
    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: 'Ошибка получения транзакций' },
      { status: 500 }
    )
  }
}

