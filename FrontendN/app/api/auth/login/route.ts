import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body
    
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Необходимы username и password' },
        { status: 400 }
      )
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.message || 'Ошибка авторизации' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type,
      client_id: data.client_id,
    })
  } catch (error: any) {
    console.error('Ошибка авторизации:', error)
    
    // Проверяем тип ошибки для более детального сообщения
    let errorMessage = 'Ошибка подключения к серверу'
    if (error?.code === 'ECONNREFUSED') {
      errorMessage = `Не удалось подключиться к backend (${API_BASE_URL}). Убедитесь что backend запущен на порту 8001.`
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

