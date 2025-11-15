'use client'

import { useState } from 'react'
import { Home, Wallet, TrendingUp, History, Settings, Plus, X, Menu, Target } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems = [
  { icon: Home, label: 'Главная', href: '/' },
  { icon: Wallet, label: 'Счета', href: '/accounts' },
  { icon: TrendingUp, label: 'Аналитика', href: '/analytics' },
  { icon: History, label: 'История', href: '/history' },
  { icon: Target, label: 'Бюджет', href: '/budget' },
  { icon: Settings, label: 'Настройки', href: '/settings' },
]

interface SidebarProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose()
    }
  }

  return (    <>
      {/* Overlay для мобильных */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-in-out
          flex flex-col
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Мобильный заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 lg:hidden flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Меню</h2>
          <button
            onClick={onMobileClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Навигационные элементы - прокручиваемая область */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
          
          {/* Кнопка подключения банка - в конце навигации */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleLinkClick}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 w-full transition font-medium"
            >
              <Plus className="h-5 w-5" />
              <span>Подключить банк</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  )
}

// Компонент для кнопки открытия мобильного меню
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  const handleClick = () => {
    onClick()
  }
  
  return (
    <button
      onClick={handleClick}
      className="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
      aria-label="Открыть меню"
    >
      <Menu className="h-6 w-6" />
    </button>
  )
}



