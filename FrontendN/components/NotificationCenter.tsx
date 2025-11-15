'use client'

import { useState } from 'react'
import { Notification } from '@/types'
import { Bell, X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/utils/format'

interface NotificationCenterProps {
  notifications?: Notification[]
  onMarkAsRead?: (id: string) => void
  onRemove?: (id: string) => void
}

export default function NotificationCenter({ notifications = [], onMarkAsRead = () => {}, onRemove = () => {} }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length

  const iconMap = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  }

  const colorMap = {
    success: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    error: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    warning: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Уведомления</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm bg-white dark:bg-gray-800">
                  Нет уведомлений
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = iconMap[notification.type]
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition bg-white dark:bg-gray-800 ${
                        !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          onMarkAsRead(notification.id)
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${colorMap[notification.type]}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {formatDate(notification.timestamp)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemove(notification.id)
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-400 dark:text-gray-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

