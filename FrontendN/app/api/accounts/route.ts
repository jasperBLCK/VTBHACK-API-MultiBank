import { NextRequest, NextResponse } from 'next/server'

// Проксирование запросов к FastAPI
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

async function proxyRequest(
  req: NextRequest,
  endpoint: string,
  options: RequestInit = {}
) {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.get('authorization')
    
    // Use Record<string, string> to allow dynamic property assignment
    const headersRecord: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }
    
    if (authHeader) {
      headersRecord['Authorization'] = authHeader
    }
    
    // Получаем тело запроса если есть
    let body: string | undefined
    if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      try {
        body = await req.text()
      } catch {
        // Тело уже прочитано или отсутствует
      }
    }
    
    const response = await fetch(url, {
      ...options,
      headers: headersRecord as HeadersInit,
      body,
    })
    
    const data = await response.json().catch(() => ({}))
    
    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || 'Ошибка запроса' },
        { status: response.status }
      )
    }
    
    // Преобразуем ответ FastAPI в формат FrontendN
    if (endpoint === '/accounts' && data.data?.account) {
      // Преобразуем формат счетов
      const accounts = data.data.account.map((acc: any) => {
        const accountNumber = acc.account[0]?.identification || acc.accountId
        const bankName = acc.account[0]?.name || 'My Bank'
        
        return {
          id: acc.accountId,
          bankName,
          accountNumber,
          balance: 0, // Баланс загружается отдельно
          currency: acc.currency,
          type: acc.accountSubType?.toLowerCase().includes('savings')
            ? 'savings'
            : acc.accountSubType?.toLowerCase().includes('credit')
            ? 'credit'
            : 'debit',
        }
      })
      
      // Загружаем балансы для каждого счета
      const accountsWithBalances = await Promise.all(
        accounts.map(async (account: any) => {
          try {
            const balanceResponse = await fetch(
              `${API_BASE_URL}/accounts/${account.id}/balances`,
              {
                headers: {
                  'Authorization': authHeader || '',
                  'Content-Type': 'application/json',
                },
              }
            )
            
            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json()
              const balance = balanceData.data?.balance?.[0]
              if (balance) {
                const amount = parseFloat(balance.amount.amount)
                account.balance = balance.creditDebitIndicator === 'Debit' ? -amount : amount
              }
            }
          } catch (error) {
            console.error(`Ошибка загрузки баланса для ${account.id}:`, error)
          }
          return account
        })
      )
      
      return NextResponse.json(accountsWithBalances)
    }
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Ошибка проксирования запроса:', error)
    
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

export async function GET(req: NextRequest) {
  return proxyRequest(req, '/accounts')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Преобразуем запрос FrontendN в формат FastAPI если нужно
  return proxyRequest(req, '/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  return proxyRequest(req, '/accounts', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
