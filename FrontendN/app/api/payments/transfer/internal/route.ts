import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(async () => {
      const text = await req.text()
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    })

    const auth = req.headers.get('authorization')

    const resp = await fetch(`${API_BASE_URL}/payments/transfer/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: auth } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })

    const text = await resp.text()
    const contentType = resp.headers.get('content-type') || 'application/json'

    // Try to return JSON if possible
    if (contentType.includes('application/json')) {
      try {
        return NextResponse.json(JSON.parse(text), { status: resp.status })
      } catch {
        return new NextResponse(text, { status: resp.status, headers: { 'content-type': contentType } })
      }
    }

    return new NextResponse(text, { status: resp.status, headers: { 'content-type': contentType } })
  } catch (error: any) {
    console.error('Proxy error /api/payments/transfer/internal:', error)
    let message = 'Ошибка при подключении к backend'
    if (error?.code === 'ECONNREFUSED') {
      message = `Не удалось подключиться к backend (${API_BASE_URL}). Убедитесь что backend запущен.`
    } else if (error?.message) {
      message = error.message
    }

    return NextResponse.json({ error: message, details: `Backend URL: ${API_BASE_URL}` }, { status: 503 })
  }
}
