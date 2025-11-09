// Система переводов
export const translations = {
  ru: {
    // Общие
    'common.loading': 'Загрузка...',
    'common.error': 'Ошибка',
    'common.success': 'Успешно',
    'common.cancel': 'Отмена',
    'common.save': 'Сохранить',
    'common.delete': 'Удалить',
    'common.edit': 'Редактировать',
    'common.close': 'Закрыть',
    
    // Навигация
    'nav.dashboard': 'Главная',
    'nav.accounts': 'Счета',
    'nav.transactions': 'Транзакции',
    'nav.budget': 'Бюджет',
    'nav.settings': 'Настройки',
    
    // Счета
    'accounts.title': 'Счета',
    'accounts.description': 'Управление вашими счетами',
    'accounts.connectBank': 'Подключить банк',
    'accounts.noAccounts': 'Нет подключенных счетов',
    'accounts.loadAccounts': 'Загрузить счета',
    
    // Переводы
    'transfer.title': 'Перевод между счетами',
    'transfer.from': 'С какого счета',
    'transfer.to': 'На какой счет',
    'transfer.amount': 'Сумма',
    'transfer.description': 'Описание',
    'transfer.submit': 'Перевести',
    'transfer.success': 'Перевод выполнен',
    'transfer.error': 'Ошибка перевода',
    
    // Бюджет
    'budget.title': 'Бюджет',
    'budget.add': 'Добавить бюджет',
    'budget.category': 'Категория',
    'budget.amount': 'Сумма',
    'budget.spent': 'Потрачено',
    'budget.remaining': 'Осталось',
    
    // Настройки
    'settings.title': 'Настройки',
    'settings.theme': 'Тема',
    'settings.language': 'Язык',
    'settings.logout': 'Выйти из аккаунта',
  },
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.accounts': 'Accounts',
    'nav.transactions': 'Transactions',
    'nav.budget': 'Budget',
    'nav.settings': 'Settings',
    
    // Accounts
    'accounts.title': 'Accounts',
    'accounts.description': 'Manage your accounts',
    'accounts.connectBank': 'Connect Bank',
    'accounts.noAccounts': 'No connected accounts',
    'accounts.loadAccounts': 'Load Accounts',
    
    // Transfers
    'transfer.title': 'Transfer between accounts',
    'transfer.from': 'From account',
    'transfer.to': 'To account',
    'transfer.amount': 'Amount',
    'transfer.description': 'Description',
    'transfer.submit': 'Transfer',
    'transfer.success': 'Transfer completed',
    'transfer.error': 'Transfer error',
    
    // Budget
    'budget.title': 'Budget',
    'budget.add': 'Add Budget',
    'budget.category': 'Category',
    'budget.amount': 'Amount',
    'budget.spent': 'Spent',
    'budget.remaining': 'Remaining',
    
    // Settings
    'settings.title': 'Settings',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.logout': 'Logout',
  },
}

export function t(key: string, lang: 'ru' | 'en' = 'ru'): string {
  const keys = key.split('.')
  let value: any = translations[lang]
  
  for (const k of keys) {
    value = value?.[k]
    if (value === undefined) {
      // Fallback на русский
      value = translations.ru
      for (const k2 of keys) {
        value = value?.[k2]
      }
      break
    }
  }
  
  return value || key
}

