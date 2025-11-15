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
    'settings.description': 'Управление настройками приложения',
    'settings.theme': 'Тема',
    'settings.themeDesc': 'Выберите светлую или тёмную тему',
    'settings.themeLight': 'Светлая',
    'settings.themeDark': 'Тёмная',
    'settings.themeSystem': 'Системная',
    'settings.language': 'Язык',
    'settings.languageDesc': 'Язык интерфейса',
    'settings.languageRu': 'Русский',
    'settings.languageEn': 'English',
    'settings.appearance': 'Внешний вид',
    'settings.sync': 'Синхронизация',
    'settings.autoSync': 'Автоматическая синхронизация',
    'settings.autoSyncDesc': 'Автоматическое обновление данных',
    'settings.syncInterval': 'Интервал синхронизации',
    'settings.syncIntervalDesc': 'Как часто обновлять данные',
    'settings.syncInterval15': '15 минут',
    'settings.syncInterval30': '30 минут',
    'settings.syncInterval60': '1 час',
    'settings.syncInterval120': '2 часа',
    'settings.syncInterval240': '4 часа',
    'settings.connectedBanks': 'Подключенные банки',
    'settings.noBanks': 'Нет подключенных банков',
    'settings.loadingBanks': 'Загрузка подключений...',
    'settings.connected': 'Подключен',
    'settings.synced': 'Синхронизировано',
    'settings.justNow': 'только что',
    'settings.minutesAgo': 'мин назад',
    'settings.disconnect': 'Отключить',
    'settings.connectNewBank': 'Подключить новый банк',
    'settings.notifications': 'Уведомления',
    'settings.pushNotifications': 'Push-уведомления',
    'settings.pushDesc': 'Получать уведомления о транзакциях',
    'settings.emailNotifications': 'Email-уведомления',
    'settings.emailDesc': 'Еженедельный отчет на email',
    'settings.security': 'Безопасность',
    'settings.changePassword': 'Изменить пароль',
    'settings.changePasswordDesc': 'Обновить пароль для входа',
    'settings.twoFactor': 'Двухфакторная аутентификация',
    'settings.twoFactorDesc': 'Дополнительная защита аккаунта',
    'settings.logout': 'Выход',
    'settings.logoutDesc': 'Выйти из аккаунта и вернуться на страницу входа',
    'settings.logoutButton': 'Выйти из аккаунта',
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
    'settings.description': 'Manage application settings',
    'settings.theme': 'Theme',
    'settings.themeDesc': 'Choose light or dark theme',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.themeSystem': 'System',
    'settings.language': 'Language',
    'settings.languageDesc': 'Interface language',
    'settings.languageRu': 'Русский',
    'settings.languageEn': 'English',
    'settings.appearance': 'Appearance',
    'settings.sync': 'Synchronization',
    'settings.autoSync': 'Auto-sync',
    'settings.autoSyncDesc': 'Automatically update data',
    'settings.syncInterval': 'Sync interval',
    'settings.syncIntervalDesc': 'How often to update data',
    'settings.syncInterval15': '15 minutes',
    'settings.syncInterval30': '30 minutes',
    'settings.syncInterval60': '1 hour',
    'settings.syncInterval120': '2 hours',
    'settings.syncInterval240': '4 hours',
    'settings.connectedBanks': 'Connected Banks',
    'settings.noBanks': 'No connected banks',
    'settings.loadingBanks': 'Loading connections...',
    'settings.connected': 'Connected',
    'settings.synced': 'Synced',
    'settings.justNow': 'just now',
    'settings.minutesAgo': 'min ago',
    'settings.disconnect': 'Disconnect',
    'settings.connectNewBank': 'Connect new bank',
    'settings.notifications': 'Notifications',
    'settings.pushNotifications': 'Push notifications',
    'settings.pushDesc': 'Receive transaction notifications',
    'settings.emailNotifications': 'Email notifications',
    'settings.emailDesc': 'Weekly email report',
    'settings.security': 'Security',
    'settings.changePassword': 'Change password',
    'settings.changePasswordDesc': 'Update login password',
    'settings.twoFactor': 'Two-factor authentication',
    'settings.twoFactorDesc': 'Additional account protection',
    'settings.logout': 'Logout',
    'settings.logoutDesc': 'Sign out and return to login page',
    'settings.logoutButton': 'Sign out',
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

