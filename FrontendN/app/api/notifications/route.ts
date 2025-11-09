import { NextRequest, NextResponse } from 'next/server'

// Простая реализация уведомлений в памяти
// В будущем можно интегрировать с реальным API
const notifications: any[] = []

export async function GET(req: NextRequest) {
  // Возвращаем пустой список или можно интегрировать с реальным API
  return NextResponse.json([])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, title, message } = body
    
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    }
    
    notifications.push(notification)
    
    return NextResponse.json(notification)
  } catch (error) {
    console.error('Ошибка создания уведомления:', error)
    return NextResponse.json(
      { error: 'Ошибка создания уведомления' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, markAsRead } = body
    
    if (markAsRead) {
      const notification = notifications.find((n) => n.id === id)
      if (notification) {
        notification.read = true
        return NextResponse.json(notification)
      }
    }
    
    return NextResponse.json({ error: 'Уведомление не найдено' }, { status: 404 })
  } catch (error) {
    console.error('Ошибка обновления уведомления:', error)
    return NextResponse.json(
      { error: 'Ошибка обновления уведомления' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const id = searchParams.get('id')
    
    if (id) {
      const index = notifications.findIndex((n) => n.id === id)
      if (index !== -1) {
        notifications.splice(index, 1)
        return NextResponse.json({ success: true })
      }
    }
    
    return NextResponse.json({ error: 'Уведомление не найдено' }, { status: 404 })
  } catch (error) {
    console.error('Ошибка удаления уведомления:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления уведомления' },
      { status: 500 }
    )
  }
}
