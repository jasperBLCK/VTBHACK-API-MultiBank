import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
        <div className="text-6xl font-bold text-gray-300 dark:text-gray-600 mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Страница не найдена
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Запрашиваемая страница не существует или была перемещена.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Home className="h-4 w-4" />
            <span>На главную</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад</span>
          </button>
        </div>
      </div>
    </div>
  )
}

