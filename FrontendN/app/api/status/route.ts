import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    
    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', message: 'Backend недоступен' },
        { status: 503 }
      )
    }
    
    const data = await response.json()
    return NextResponse.json({
      status: 'ok',
      backend: data,
    })
  } catch (error: any) {
    console.error('Ошибка проверки статуса backend:', error)
    
    let errorMessage = 'Ошибка подключения к backend'
    if (error?.code === 'ECONNREFUSED') {
      errorMessage = `Не удалось подключиться к backend на ${API_BASE_URL}`
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { 
        status: 'error', 
        message: errorMessage,
        backendUrl: API_BASE_URL,
        hint: 'Убедитесь что backend запущен: python run.py',
        error: error?.code || 'UNKNOWN'
      },
      { status: 503 }
    )
  }
}
