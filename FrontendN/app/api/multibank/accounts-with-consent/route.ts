import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bank_url, bank_token, consent_id, client_id } = body
    
    if (!bank_url || !bank_token || !consent_id || !client_id) {
      return NextResponse.json(
        { error: 'bank_url, bank_token, consent_id и client_id обязательны' },
        { status: 400 }
      )
    }
    
    const response = await fetch(`${API_BASE_URL}/multibank/accounts-with-consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bank_url, bank_token, consent_id, client_id }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.message || 'Ошибка получения счетов' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Ошибка получения счетов:', error)
    
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

