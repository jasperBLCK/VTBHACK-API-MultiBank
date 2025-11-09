import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

async function proxyRequest(
  req: NextRequest,
  endpoint: string,
  options: RequestInit = {}
) {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    const authHeader = req.headers.get('authorization')
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    if (authHeader) {
      headers['Authorization'] = authHeader
    }
    
    let body: string | undefined
    if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      try {
        body = await req.text()
      } catch {
        // Тело уже прочитано
      }
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
      body,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.message || 'Ошибка запроса' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    // Преобразуем ответ FastAPI в формат FrontendN
    if (data.data?.transaction) {
      const transactions = data.data.transaction.map((txn: any) => {
        const amount = parseFloat(txn.amount.amount)
        const isDebit = txn.creditDebitIndicator === 'Debit'
        const finalAmount = isDebit ? -amount : amount
        
        let type: 'transfer' | 'payment' | 'income' = 'payment'
        if (finalAmount > 0) {
          type = 'income'
        } else if (txn.remittanceInformation?.reference?.includes('transfer')) {
          type = 'transfer'
        }
        
        let category: 'income' | 'shopping' | 'food' | 'transport' | 'bills' | 'other' = 'other'
        const description = txn.transactionInformation || txn.remittanceInformation?.unstructured || ''
        const descLower = description.toLowerCase()
        if (descLower.includes('еда') || descLower.includes('food') || descLower.includes('ресторан')) {
          category = 'food'
        } else if (descLower.includes('транспорт') || descLower.includes('transport') || descLower.includes('метро')) {
          category = 'transport'
        } else if (descLower.includes('покупк') || descLower.includes('shopping') || descLower.includes('магазин')) {
          category = 'shopping'
        } else if (descLower.includes('счет') || descLower.includes('bill') || descLower.includes('оплат')) {
          category = 'bills'
        } else if (finalAmount > 0) {
          category = 'income'
        }
        
        return {
          id: txn.transactionId,
          accountId: txn.accountId,
          amount: finalAmount,
          currency: txn.amount.currency,
          description: description || 'Транзакция',
          date: txn.bookingDateTime,
          category,
          type,
        }
      })
      
      return NextResponse.json(transactions)
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
  const searchParams = req.nextUrl.searchParams
  const accountId = searchParams.get('accountId')
  
  if (!accountId) {
    // Если accountId не указан, получаем все транзакции по всем счетам
    // Сначала получаем список счетов
    try {
      const authHeader = req.headers.get('authorization')
      const accountsResponse = await fetch(`${API_BASE_URL}/accounts`, {
        headers: {
          'Authorization': authHeader || '',
          'Content-Type': 'application/json',
        },
      })
      
      if (!accountsResponse.ok) {
        return NextResponse.json(
          { error: 'Ошибка загрузки счетов' },
          { status: accountsResponse.status }
        )
      }
      
      const accountsData = await accountsResponse.json()
      const accounts = accountsData.data?.account || []
      
      // Загружаем транзакции для каждого счета
      const allTransactions: any[] = []
      for (const account of accounts) {
        try {
          const txnResponse = await fetch(
            `${API_BASE_URL}/accounts/${account.accountId}/transactions`,
            {
              headers: {
                'Authorization': authHeader || '',
                'Content-Type': 'application/json',
              },
            }
          )
          
          if (txnResponse.ok) {
            const txnData = await txnResponse.json()
            if (txnData.data?.transaction) {
              const transactions = txnData.data.transaction.map((txn: any) => {
                const amount = parseFloat(txn.amount.amount)
                const isDebit = txn.creditDebitIndicator === 'Debit'
                const finalAmount = isDebit ? -amount : amount
                
                let type: 'transfer' | 'payment' | 'income' = 'payment'
                if (finalAmount > 0) {
                  type = 'income'
                } else if (txn.remittanceInformation?.reference?.includes('transfer')) {
                  type = 'transfer'
                }
                
                let category: 'income' | 'shopping' | 'food' | 'transport' | 'bills' | 'other' = 'other'
                const description = txn.transactionInformation || txn.remittanceInformation?.unstructured || ''
                const descLower = description.toLowerCase()
                if (descLower.includes('еда') || descLower.includes('food') || descLower.includes('ресторан')) {
                  category = 'food'
                } else if (descLower.includes('транспорт') || descLower.includes('transport') || descLower.includes('метро')) {
                  category = 'transport'
                } else if (descLower.includes('покупк') || descLower.includes('shopping') || descLower.includes('магазин')) {
                  category = 'shopping'
                } else if (descLower.includes('счет') || descLower.includes('bill') || descLower.includes('оплат')) {
                  category = 'bills'
                } else if (finalAmount > 0) {
                  category = 'income'
                }
                
                return {
                  id: txn.transactionId,
                  accountId: txn.accountId,
                  amount: finalAmount,
                  currency: txn.amount.currency,
                  description: description || 'Транзакция',
                  date: txn.bookingDateTime,
                  category,
                  type,
                }
              })
              allTransactions.push(...transactions)
            }
          }
  } catch (error) {
          console.error(`Ошибка загрузки транзакций для счета ${account.accountId}:`, error)
        }
      }
      
      // Сортируем по дате
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      return NextResponse.json(allTransactions)
    } catch (error: any) {
      console.error('Ошибка загрузки всех транзакций:', error)
      
      let errorMessage = 'Ошибка загрузки транзакций'
      if (error?.code === 'ECONNREFUSED') {
        errorMessage = `Не удалось подключиться к backend (${API_BASE_URL}). Убедитесь что backend запущен.`
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
  
  return proxyRequest(req, `/accounts/${accountId}/transactions`)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Транзакции создаются через payments API
  return NextResponse.json(
    { error: 'Используйте /api/transfer для создания переводов' },
    { status: 400 }
  )
}
