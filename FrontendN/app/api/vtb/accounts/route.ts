import { NextResponse } from 'next/server'
import { vtbApi } from '@/lib/vtb-api'

export async function GET() {
  try {
    const accounts = await vtbApi.getAccounts()
    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: 'Ошибка получения счетов' },
      { status: 500 }
    )
  }
}

