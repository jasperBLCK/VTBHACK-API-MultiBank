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
    
    const response = await fetch(`${API_BASE_URL}/multibank/cards-with-consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bank_url, bank_token, consent_id, client_id }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // Не выбрасываем ошибку, просто возвращаем пустой список карт
      return NextResponse.json({ data: { card: [] } })
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Ошибка получения карт:', error)
    // Возвращаем пустой список вместо ошибки
    return NextResponse.json({ data: { card: [] } })
  }
}

