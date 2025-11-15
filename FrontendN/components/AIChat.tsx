'use client'

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import { MessageCircle, X, Send, Bot, User } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Здравствуйте! Я AI-ассистент MultiBank 👋\n\nЯ могу помочь вам с:\n• Информацией о счетах и балансах\n• Просмотром транзакций\n• Переводами между счетами\n• Финансовыми советами\n\nЗадайте любой вопрос!',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Функция для извлечения контекста страницы
  const getPageContext = () => {
    try {
      const context: any = {
        currentUrl: window.location.pathname,
        pageType: 'unknown',
      }

      // Определяем тип страницы
      if (window.location.pathname.includes('/accounts')) {
        context.pageType = 'accounts'
      } else if (window.location.pathname.includes('/history')) {
        context.pageType = 'history'
      } else if (window.location.pathname.includes('/budget')) {
        context.pageType = 'budget'
      } else if (window.location.pathname === '/') {
        context.pageType = 'dashboard'
      }

      // Извлекаем счета с DOM
      const accountCards = document.querySelectorAll('[class*="AccountCard"], [class*="bg-white"][class*="rounded"], div[class*="p-4"][class*="border"]')
      const accounts: any[] = []
      
      accountCards.forEach((card) => {
        const text = card.textContent || ''
        // Ищем баланс (число + ₽)
        const balanceMatch = text.match(/([\d\s,]+)\s*₽/)
        // Ищем номер карты
        const cardMatch = text.match(/\*\*\*\*\s*(\d{4})|(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/)
        // Ищем название счета
        const nameMatch = text.match(/^([^\d₽]+)/)
        
        if (balanceMatch || cardMatch) {
          accounts.push({
            name: nameMatch ? nameMatch[1].trim() : 'Счет',
            balance: balanceMatch ? balanceMatch[1].replace(/\s/g, '') : '0',
            cardNumber: cardMatch ? cardMatch[0] : null,
          })
        }
      })
      
      if (accounts.length > 0) {
        context.accounts = accounts
      }

      // Извлекаем транзакции с DOM
      const transactionItems = document.querySelectorAll('[class*="transaction"], [class*="history"] li, table tbody tr')
      const transactions: any[] = []
      
      transactionItems.forEach((item, index) => {
        if (index >= 10) return // Максимум 10 последних транзакций
        const text = item.textContent || ''
        const amountMatch = text.match(/([+-]?\s*[\d\s,]+)\s*₽/)
        
        if (amountMatch) {
          transactions.push({
            description: text.substring(0, 100).trim(),
            amount: amountMatch[1].replace(/\s/g, ''),
          })
        }
      })
      
      if (transactions.length > 0) {
        context.transactions = transactions
      }

      // Извлекаем бюджеты с DOM
      const budgetItems = document.querySelectorAll('[class*="budget"], [class*="category"]')
      const budgets: any[] = []
      
      budgetItems.forEach((item) => {
        const text = item.textContent || ''
        const amountMatch = text.match(/([\d\s,]+)\s*₽/)
        const percentMatch = text.match(/(\d+)%/)
        
        if (amountMatch) {
          budgets.push({
            category: text.substring(0, 50).trim(),
            amount: amountMatch[1].replace(/\s/g, ''),
            percent: percentMatch ? percentMatch[1] : null,
          })
        }
      })
      
      if (budgets.length > 0) {
        context.budgets = budgets
      }

      // Извлекаем общий баланс с DOM
      const balanceElements = document.querySelectorAll('h1, h2, h3, [class*="balance"], [class*="total"]')
      balanceElements.forEach((el) => {
        const text = el.textContent || ''
        const match = text.match(/Общий баланс[:\s]*([\d\s,]+)\s*₽/i)
        if (match) {
          context.totalBalance = match[1].replace(/\s/g, '')
        }
      })

      return context
    } catch (error) {
      console.error('Error extracting page context:', error)
      return { currentUrl: window.location.pathname }
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Получаем токен для доступа к данным пользователя
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Получаем контекст страницы
      const pageContext = getPageContext()

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          message: userMessage.content,
          pageContext 
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || 'Извините, не могу ответить на этот вопрос.',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('API Error')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Временный ответ-заглушка пока API не подключен
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Извините, сервис временно недоступен. Пожалуйста, попробуйте позже.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
          aria-label="Открыть чат с AI"
        >
          <MessageCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">AI Ассистент</h3>
                <p className="text-xs text-white/80">Онлайн</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded-full p-1 transition"
              aria-label="Закрыть чат"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className={`rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
                      {message.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Напишите сообщение..."
                rows={1}
                className="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center"
                aria-label="Отправить сообщение"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              AI может ошибаться. Проверяйте важную информацию.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
