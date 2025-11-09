import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

/**
 * Проверка доступности backend
 */
export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Таймаут 5 секунд
      signal: AbortSignal.timeout(5000),
    })
    
    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'error',
          backendUrl: API_BASE_URL,
          message: 'Backend вернул ошибку',
          statusCode: response.status,
        },
        { status: 503 }
      )
    }
    
    const data = await response.json()
    return NextResponse.json({
      status: 'ok',
      backendUrl: API_BASE_URL,
      backend: data,
    })
  } catch (error: any) {
    console.error('Ошибка проверки здоровья backend:', error)
    
    let errorMessage = 'Backend недоступен'
    if (error?.code === 'ECONNREFUSED') {
      errorMessage = `Не удалось подключиться к backend на ${API_BASE_URL}`
    } else if (error?.name === 'AbortError') {
      errorMessage = 'Таймаут при подключении к backend'
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      {
        status: 'error',
        backendUrl: API_BASE_URL,
        message: errorMessage,
        hint: 'Убедитесь что backend запущен: python run.py',
        error: error?.code || 'UNKNOWN',
      },
      { status: 503 }
    )
  }
}

