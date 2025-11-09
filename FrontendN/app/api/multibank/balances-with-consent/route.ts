import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const account_id = searchParams.get('account_id')
    const bank_url = searchParams.get('bank_url')
    const bank_token = searchParams.get('bank_token')
    const consent_id = searchParams.get('consent_id')
    
    if (!account_id || !bank_url || !bank_token || !consent_id) {
      return NextResponse.json(
        { error: 'account_id, bank_url, bank_token и consent_id обязательны' },
        { status: 400 }
      )
    }
    
    const response = await fetch(
      `${API_BASE_URL}/multibank/balances-with-consent?account_id=${encodeURIComponent(account_id)}&bank_url=${encodeURIComponent(bank_url)}&bank_token=${encodeURIComponent(bank_token)}&consent_id=${encodeURIComponent(consent_id)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.message || 'Ошибка получения баланса' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Ошибка получения баланса:', error)
    
    let errorMessage = 'Ошибка подключения к серверу'
    if (error?.code === 'ECONNREFUSED') {
      errorMessage = `Не удалось подключиться к backend (${API_BASE_URL}). Убедитесь что backend запущен.`
    } else if (error?.message) {
      errorMessage = `Ошибка подключения: ${error.message}`
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: `Backend URL: ${API_BASE_URL}`,
        hint: 'Убедитесь что backend запущен: python run.py'
      },
      { status: 503 }
    )
  }
}

