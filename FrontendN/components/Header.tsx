'use client'

import { Wallet, Settings } from 'lucide-react'
import NotificationCenter from './NotificationCenter'
import { MobileMenuButton } from './Sidebar'
import { Notification } from '@/types'
import Link from 'next/link'

interface HeaderProps {
  notifications?: Notification[]
  onMarkAsRead?: (id: string) => void
  onRemoveNotification?: (id: string) => void
  onMenuClick?: () => void
}

export default function Header({ notifications = [], onMarkAsRead = () => {}, onRemoveNotification = () => {}, onMenuClick }: HeaderProps) {
  const handleMenuClick = onMenuClick || (() => {})
  
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 w-full">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16 w-full">
          {/* Левая часть: Логотип + Название + Мобильное меню */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {onMenuClick && <MobileMenuButton onClick={handleMenuClick} />}
            <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap">FinScope</h1>
          </div>
          
          {/* Правая часть: Уведомления + Настройки + Аватар */}
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={onMarkAsRead}
              onRemove={onRemoveNotification}
            />
            <Link
              href="/settings"
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition flex-shrink-0"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              А
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

