import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fromAccountId, toAccountId, amount, description } = body
    
    if (!fromAccountId || !toAccountId || !amount) {
      return NextResponse.json(
        { error: 'Необходимы fromAccountId, toAccountId и amount' },
        { status: 400 }
      )
    }
    
    const authHeader = req.headers.get('authorization')
    
    // Сначала получаем информацию о счетах
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
    
    const fromAccount = accounts.find((acc: any) => acc.accountId === fromAccountId)
    const toAccount = accounts.find((acc: any) => acc.accountId === toAccountId)
    
    if (!fromAccount || !toAccount) {
      return NextResponse.json(
        { error: 'Счета не найдены' },
        { status: 404 }
      )
    }
    
    // Формируем запрос в формате OpenBanking Russia Payments API
    const paymentRequest = {
      data: {
        initiation: {
          instructionIdentification: `instr-${Date.now()}`,
          endToEndIdentification: `e2e-${Date.now()}`,
          instructedAmount: {
            amount: amount.toFixed(2),
            currency: fromAccount.currency || 'RUB',
          },
          debtorAccount: {
            schemeName: 'RU.CBR.PAN',
            identification: fromAccount.account[0]?.identification || fromAccountId,
            name: fromAccount.account[0]?.name || 'Debtor',
          },
          creditorAccount: {
            schemeName: 'RU.CBR.PAN',
            identification: toAccount.account[0]?.identification || toAccountId,
            name: toAccount.account[0]?.name || 'Creditor',
          },
          remittanceInformation: {
            unstructured: description || 'Перевод',
          },
        },
      },
    }
    
    const paymentResponse = await fetch(`${API_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentRequest),
    })
    
    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.message || 'Ошибка выполнения перевода' },
        { status: paymentResponse.status }
      )
    }
    
    const paymentData = await paymentResponse.json()
    
    return NextResponse.json({
      success: true,
      paymentId: paymentData.data?.paymentId || paymentData.data?.payment?.paymentId,
      status: paymentData.data?.status || paymentData.data?.payment?.status,
    })
  } catch (error: any) {
    console.error('Ошибка выполнения перевода:', error)
    
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
