import { NextRequest, NextResponse } from 'next/server'

const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_API_URL = process.env.LLM_API_URL || 'https://api.nixai.ru/v1/chat/completions'

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

async function getUserContext(token: string) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

    // Получаем все данные параллельно через Next.js API routes (которые проксируют к backend)
    const [accountsRes, multibankRes, transactionsRes, budgetsRes] = await Promise.all([
      fetch(`${baseUrl}/api/accounts`, { headers }),
      fetch(`${baseUrl}/api/multibank/accounts`, { headers }),
      fetch(`${baseUrl}/api/transactions`, { headers }),
      fetch(`${baseUrl}/api/budgets`, { headers }),
    ])

    const accounts = accountsRes.ok ? await accountsRes.json() : []
    const multibankAccounts = multibankRes.ok ? await multibankRes.json() : []
    const transactions = transactionsRes.ok ? await transactionsRes.json() : []
    const budgets = budgetsRes.ok ? await budgetsRes.json() : []

    const allAccounts = [...accounts, ...multibankAccounts]

    const totalBalance = allAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)
    
    const accountsList = allAccounts.map((acc: any) => {
      const bankName = acc.bankName || acc.bank_name || acc.bank || 'FinScope'
      const accountName = acc.accountName || acc.account_name || acc.name || 'Счет'
      const balance = acc.balance || 0
      const currency = acc.currency || 'RUB'
      const isMultibank = acc.source === 'multibank' || acc.externalBankId
      
      return `- ${accountName} (${bankName}${isMultibank ? ' - подключен через Open Banking' : ' - локальный'}): ${balance.toFixed(2)} ${currency}`
    }).join('\n')

    // Анализ транзакций
    const recentTransactions = transactions.slice(0, 10).map((tx: any) => {
      const date = new Date(tx.transactionDate || tx.transaction_date || tx.date)
      const amount = tx.amount || 0
      const type = amount > 0 ? 'Пополнение' : 'Списание'
      return `- ${date.toLocaleDateString('ru-RU')}: ${tx.description} | ${type}: ${Math.abs(amount).toFixed(2)} ${tx.currency || 'RUB'}`
    }).join('\n')

    // Подсчет расходов и доходов
    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)
    
    const thisMonthTransactions = transactions.filter((tx: any) => {
      const txDate = new Date(tx.transactionDate || tx.transaction_date || tx.date)
      return txDate >= thisMonthStart
    })

    const totalIncome = thisMonthTransactions
      .filter((tx: any) => (tx.amount || 0) > 0)
      .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)

    const totalExpenses = Math.abs(thisMonthTransactions
      .filter((tx: any) => (tx.amount || 0) < 0)
      .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0))

    // Анализ по категориям
    const categorySpending: Record<string, number> = {}
    thisMonthTransactions.forEach((tx: any) => {
      if ((tx.amount || 0) < 0 && tx.category) {
        const category = tx.category
        categorySpending[category] = (categorySpending[category] || 0) + Math.abs(tx.amount || 0)
      }
    })

    const categoryNames: Record<string, string> = {
      food: 'Еда',
      transport: 'Транспорт',
      shopping: 'Покупки',
      bills: 'Счета',
      entertainment: 'Развлечения',
      health: 'Здоровье',
      education: 'Образование',
      other: 'Прочее',
    }

    const categoriesBreakdown = Object.entries(categorySpending)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, amount]) => `  • ${categoryNames[cat] || cat}: ${amount.toFixed(2)} RUB`)
      .join('\n')

    // Анализ бюджетов
    const budgetsList = budgets.map((b: any) => {
      const categoryName = categoryNames[b.category] || b.category
      const spent = categorySpending[b.category] || 0
      const remaining = b.amount - spent
      const percentage = b.amount > 0 ? ((spent / b.amount) * 100).toFixed(1) : 0
      const status = spent > b.amount ? '⚠️ ПРЕВЫШЕН' : remaining < b.amount * 0.2 ? '⚡ Заканчивается' : '✅ В норме'
      
      return `  • ${categoryName}: ${spent.toFixed(2)} / ${b.amount} RUB (${percentage}%) - ${status}`
    }).join('\n')

    const totalBudget = budgets.reduce((sum: number, b: any) => sum + (b.amount || 0), 0)
    const exceededBudgets = budgets.filter((b: any) => (categorySpending[b.category] || 0) > b.amount).length

    return {
      accountsCount: allAccounts.length,
      localAccountsCount: accounts.length,
      multibankAccountsCount: multibankAccounts.length,
      totalBalance,
      accountsList,
      recentTransactions,
      hasAccounts: allAccounts.length > 0,
      hasTransactions: transactions.length > 0,
      hasBudgets: budgets.length > 0,
      totalIncome,
      totalExpenses,
      categoriesBreakdown,
      budgetsList,
      totalBudget,
      exceededBudgets,
      transactionsCount: transactions.length,
      thisMonthTransactionsCount: thisMonthTransactions.length,
    }
  } catch (error) {
    console.error('Ошибка получения контекста пользователя:', error)
    return {
      accountsCount: 0,
      localAccountsCount: 0,
      multibankAccountsCount: 0,
      totalBalance: 0,
      accountsList: '',
      recentTransactions: '',
      hasAccounts: false,
      hasTransactions: false,
      hasBudgets: false,
      totalIncome: 0,
      totalExpenses: 0,
      categoriesBreakdown: '',
      budgetsList: '',
      totalBudget: 0,
      exceededBudgets: 0,
      transactionsCount: 0,
      thisMonthTransactionsCount: 0,
    }
  }
}

function generateSmartResponse(message: string, userContext: any) {
  const lower = message.toLowerCase()

  // Вопросы о балансе
  if (lower.includes('баланс') || lower.includes('сколько денег') || lower.includes('остаток')) {
    if (userContext?.hasAccounts) {
      const breakdown = userContext.multibankAccountsCount > 0 
        ? `\n\n📊 Распределение по источникам:\n• Локальные счета FinScope: ${userContext.localAccountsCount} шт.\n• Подключенные из банков: ${userContext.multibankAccountsCount} шт. (SBank, ABank, VBank)` 
        : ''
      return `💰 Ваш совокупный баланс по всем счетам: ${userContext.totalBalance.toFixed(2)} RUB\n\nВсего счетов: ${userContext.accountsCount}${breakdown}\n\n📋 Детализация по счетам:\n${userContext.accountsList}\n\n💡 FinScope автоматически агрегирует данные со всех подключенных банков в реальном времени!`
    }
    return '📭 У вас пока нет подключенных счетов.\n\n🎯 Начните прямо сейчас:\n1. Создайте счет в FinScope\n2. Или подключите существующие счета из банков через "Настройки" → "Подключенные банки"\n\n✨ После подключения я смогу показывать полную картину ваших финансов!'
  }

  // Вопросы о счетах
  if (lower.includes('счет') || lower.includes('account')) {
    if (userContext?.hasAccounts) {
      const multibankInfo = userContext.multibankAccountsCount > 0 
        ? `\n\n🌟 Отлично! У вас подключено ${userContext.multibankAccountsCount} счетов из внешних банков через Open Banking API.` 
        : '\n\n💡 Подключите счета из других банков для полной картины финансов!'
      return `🏦 У вас активно ${userContext.accountsCount} счетов в FinScope:\n\n${userContext.accountsList}${multibankInfo}\n\n📱 Все счета синхронизируются автоматически и доступны в едином интерфейсе.`
    }
    return '📭 У вас пока нет счетов.\n\n🚀 FinScope позволяет:\n• Создавать локальные счета\n• Подключать счета из SBank, ABank, VBank\n• Управлять всем из одного приложения\n\nНачните с раздела "Счета" или "Настройки"!'
  }

  // Вопросы о транзакциях
  if (lower.includes('транзакц') || lower.includes('операц') || lower.includes('платеж') || lower.includes('история')) {
    if (userContext?.hasTransactions) {
      return `📊 Ваши последние операции:\n${userContext.recentTransactions}\n\n📈 Статистика за текущий месяц:\n• Всего операций: ${userContext.thisMonthTransactionsCount}\n• Доходы: ${userContext.totalIncome.toFixed(2)} RUB\n• Расходы: ${userContext.totalExpenses.toFixed(2)} RUB\n• Баланс: ${(userContext.totalIncome - userContext.totalExpenses).toFixed(2)} RUB\n\n💡 FinScope собирает транзакции со всех подключенных банков и отображает их в едином формате для удобного анализа.\n\n📋 Полную историю смотрите в разделе "История операций".`
    }
    return '📭 Транзакций пока нет.\n\n💳 После совершения операций или подключения банковских счетов, здесь будет отображаться история со всех источников.'
  }

  // Вопросы о расходах и категориях
  if (lower.includes('расход') || lower.includes('трат') || lower.includes('категор') || lower.includes('куда ух') || lower.includes('на что')) {
    if (userContext?.categoriesBreakdown) {
      return `💸 Расходы за текущий месяц: ${userContext.totalExpenses.toFixed(2)} RUB\n\n📊 ТОП-5 категорий расходов:\n${userContext.categoriesBreakdown}\n\n${userContext.hasBudgets ? `📋 Статус бюджетов:\n${userContext.budgetsList}\n\n${userContext.exceededBudgets > 0 ? `⚠️ Внимание! Превышено бюджетов: ${userContext.exceededBudgets}` : '✅ Все бюджеты в норме!'}` : '💡 Совет: настройте бюджеты в разделе "Бюджет" для контроля расходов!'}\n\n💡 FinScope автоматически категоризирует ваши траты для удобного анализа.`
    }
    if (userContext?.hasTransactions) {
      return `📊 У вас есть транзакции, но пока нет расходов в текущем месяце.\n\n💡 После появления расходов я покажу детальную аналитику по категориям!`
    }
    return '📭 Расходов пока нет. Совершите первые покупки, и я помогу их проанализировать!'
  }

  // Вопросы о бюджете
  if (lower.includes('бюджет') || lower.includes('лимит') || lower.includes('план')) {
    if (userContext?.hasBudgets) {
      const status = userContext.exceededBudgets > 0 
        ? `⚠️ ВНИМАНИЕ! Превышено бюджетов: ${userContext.exceededBudgets}` 
        : '✅ Все бюджеты в норме!'
      return `📊 Ваши бюджеты (месячные лимиты):\n\n${userContext.budgetsList}\n\n💰 Общий бюджет: ${userContext.totalBudget.toFixed(2)} RUB\n📉 Потрачено: ${userContext.totalExpenses.toFixed(2)} RUB\n💵 Осталось: ${(userContext.totalBudget - userContext.totalExpenses).toFixed(2)} RUB\n\n${status}\n\n💡 FinScope помогает контролировать расходы по категориям и предупреждает о превышении лимитов!`
    }
    return '📋 У вас пока не настроены бюджеты.\n\n🎯 Рекомендую создать бюджеты для контроля расходов:\n1. Перейдите в раздел "Бюджет"\n2. Нажмите "Добавить бюджет"\n3. Выберите категорию (Еда, Транспорт и т.д.)\n4. Установите месячный лимит\n\n💡 FinScope будет автоматически отслеживать ваши траты и предупреждать о превышении!'
  }

  // Вопросы о доходах
  if (lower.includes('доход') || lower.includes('зарплат') || lower.includes('поступлен')) {
    if (userContext?.hasTransactions) {
      return `💰 Доходы за текущий месяц: ${userContext.totalIncome.toFixed(2)} RUB\n\n📊 Финансовая статистика:\n• Доходы: ${userContext.totalIncome.toFixed(2)} RUB\n• Расходы: ${userContext.totalExpenses.toFixed(2)} RUB\n• Чистый баланс: ${(userContext.totalIncome - userContext.totalExpenses).toFixed(2)} RUB\n\n${userContext.totalIncome > userContext.totalExpenses ? '✅ Отлично! Доходы превышают расходы.' : userContext.totalIncome < userContext.totalExpenses ? '⚠️ Расходы превышают доходы. Рекомендую проанализировать траты.' : '⚖️ Доходы равны расходам.'}\n\n💡 FinScope автоматически разделяет доходы и расходы для финансового анализа.`
    }
    return '📭 Данных о доходах пока нет. После поступления средств я покажу детальную статистику!'
  }

  // О FinScope/MultiBank
  if (lower.includes('finscope') || lower.includes('multibank') || lower.includes('мультибанк') || lower.includes('что это') || lower.includes('как работает')) {
    return `🏦 FinScope (MultiBank) - современный мультибанковский агрегатор!

🎯 ГЛАВНАЯ ИДЕЯ:
Вместо того чтобы заходить в приложение каждого банка отдельно, FinScope объединяет ВСЕ ваши счета в одном месте.

✨ ЧТО ВЫ ПОЛУЧАЕТЕ:
• Все счета из разных банков на одном экране
• Единая история операций со всех банков
• Общий баланс и аналитика по всем финансам
• Переводы между счетами из разных банков
• Категоризация расходов и бюджетирование

🔗 КАК ЭТО РАБОТАЕТ:
1. Вы подключаете банки через безопасный Open Banking API
2. FinScope получает доступ только к чтению данных (с вашего согласия)
3. Данные автоматически синхронизируются
4. Вы видите все свои финансы в удобном формате

🏦 СЕЙЧАС ПОДКЛЮЧЕНЫ:
• SBank - песочница для тестирования
• ABank - песочница для тестирования  
• VBank - песочница для тестирования

🚀 В РЕАЛЬНОЙ ВЕРСИИ:
ВТБ, Сбербанк, Альфа-Банк, Тинькофф, Райффайзен, Газпромбанк и другие российские банки!

🔒 БЕЗОПАСНОСТЬ:
• Официальный стандарт Open Banking
• Одобрено ЦБ РФ
• Никакого доступа к паролям
• Шифрование данных`
  }

  // Вопросы о безопасности
  if (lower.includes('безопасн') || lower.includes('защит') || lower.includes('данные') || lower.includes('пароль')) {
    return `🔒 БЕЗОПАСНОСТЬ FINSCOPE:\n\n✅ Open Banking API Standard:\n• Официальный стандарт подключения банков\n• Регулируется Центральным Банком РФ\n• Используют крупнейшие банки мира\n\n✅ Что мы НЕ делаем:\n• НЕ храним пароли от банков\n• НЕ имеем доступа к вашим банковским приложениям\n• НЕ можем совершать операции без согласия\n\n✅ Как работает подключение:\n1. Вы переходите на сайт ВАШЕГО банка\n2. Вводите пароль в интерфейсе БАНКА (не нашего!)\n3. Банк выдает FinScope разовый токен доступа\n4. Мы используем токен только для чтения данных\n\n🔐 Технологии:\n• OAuth 2.0 - мировой стандарт\n• End-to-end шифрование\n• Регулярный аудит безопасности\n• Сертификаты соответствия\n\n💡 Это тот же принцип, который используют Google Pay, Apple Pay и другие сервисы!`
  }

  // Приветствия
  if (lower.includes('привет') || lower.includes('здравств') || lower.includes('добр')) {
    if (userContext?.hasAccounts) {
      const multibankStatus = userContext.multibankAccountsCount > 0 
        ? `\n🌟 Отлично, что вы используете мультибанковые возможности! Подключено банков: ${userContext.multibankAccountsCount}`
        : '\n💡 Совет: подключите счета из других банков для полной картины'
      return `Здравствуйте! 👋\n\n💰 Ваш совокупный баланс: ${userContext.totalBalance.toFixed(2)} RUB\n📊 Активных счетов: ${userContext.accountsCount}${multibankStatus}\n\nЯ ваш личный финансовый ассистент. Могу помочь с:\n• Анализом финансов\n• Вопросами о счетах\n• Переводами\n• Советами по бюджету\n\nЧем могу помочь?`
    }
    return `Здравствуйте! 👋\n\nЯ AI-ассистент FinScope - вашего мультибанкового помощника!\n\n🎯 Я помогу вам:\n• Управлять счетами из разных банков\n• Анализировать финансы\n• Планировать бюджет\n• Оптимизировать расходы\n\n💡 Начните с подключения ваших банковских счетов, и я покажу полную картину ваших финансов!\n\nЧем могу помочь?`
  }

  // Помощь
  if (lower.includes('помощь') || lower.includes('help') || lower.includes('что умеешь') || lower.includes('команды')) {
    const balanceInfo = userContext?.hasAccounts 
      ? `\n\n💰 Ваш текущий статус:\n• Баланс: ${userContext.totalBalance.toFixed(2)} RUB\n• Счетов: ${userContext.accountsCount}\n• Из них подключенных: ${userContext.multibankAccountsCount}` 
      : ''
    return `🤖 Я AI финансовый ассистент FinScope!\n\n📋 МОИ ВОЗМОЖНОСТИ:\n\n💰 Финансовый анализ:\n• Показать баланс по всем счетам\n• Детализация по банкам\n• Анализ транзакций\n• Категоризация расходов\n\n📊 Консультации:\n• Советы по бюджетированию\n• Оптимизация расходов\n• Финансовое планирование\n\n🏦 О FinScope:\n• Как работает мультибанкинг\n• Безопасность и защита данных\n• Подключение новых банков\n• Возможности платформы\n\n💳 Операции:\n• Помощь с переводами\n• История операций\n• Настройка счетов${balanceInfo}\n\n💬 Просто задайте вопрос естественным языком!\nНапример: "Сколько денег на счетах?", "Покажи последние траты", "Как подключить ВТБ?"`
  }

  // Стандартный ответ
  const accountsStatus = userContext?.hasAccounts 
    ? `У вас ${userContext.accountsCount} активных счетов с балансом ${userContext.totalBalance.toFixed(2)} RUB.${userContext.multibankAccountsCount > 0 ? `\n🌟 Подключено банков: ${userContext.multibankAccountsCount}` : ''}` 
    : 'Подключите банки для начала работы.'
    
  return `Спасибо за вопрос!\n\n🤖 Я AI-ассистент FinScope (MultiBank) - вашего мультибанкового помощника.\n\n📊 Текущий статус:\n${accountsStatus}\n\n💡 Я могу помочь с:\n• 💰 Анализом финансов и балансов\n• 📈 Историей транзакций\n• 💸 Переводами между счетами\n• 🏦 Информацией о мультибанкинге\n• 🔒 Вопросами безопасности\n• ⚙️ Настройками FinScope\n\nЗадайте конкретный вопрос, и я с радостью помогу! 😊`
}

export async function POST(request: NextRequest) {
  try {
    const { message, pageContext } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Сообщение не может быть пустым' },
        { status: 400 }
      )
    }

    const token = getAuthToken(request)
    const userContext = token ? await getUserContext(token) : null

    let systemPrompt = `Ты профессиональный AI финансовый ассистент приложения FinScope (также известного как MultiBank).

🏦 ЧТО ТАКОЕ FINSCOPE:
FinScope - это современное мультибанковское приложение-агрегатор, которое объединяет счета из разных банков России в единый интерфейс.

📱 АРХИТЕКТУРА:
- FinScope (наше приложение) - центральная платформа
- Подключенные банки: SBank, ABank, VBank (песочницы Open Banking)
- В реальной версии: ВТБ, Сбербанк, Альфа-Банк, Тинькофф, Райффайзен, Газпромбанк и др.
- Интеграция через Open Banking API стандарт
- Безопасная синхронизация данных в реальном времени

💡 ТИПЫ СЧЕТОВ:
1. Локальные счета - созданы непосредственно в FinScope
2. Подключенные счета - импортированы из внешних банков (SBank, ABank, VBank и др.)
   - Отображаются с пометкой источника
   - Синхронизируются автоматически
   - Доступны для просмотра и анализа

🎯 ОСНОВНЫЕ ВОЗМОЖНОСТИ:
• Агрегация всех банковских счетов в одном приложении
• Просмотр балансов и транзакций со всех подключенных банков
• Переводы между своими счетами (даже из разных банков)
• Финансовая аналитика: расходы, доходы, категории
• Бюджетирование и планирование
• История операций из всех банков в едином формате
• Уведомления о движениях по всем счетам

🔒 БЕЗОПАСНОСТЬ:
- OAuth 2.0 аутентификация
- Шифрование данных end-to-end
- Соответствие стандартам ЦБ РФ
- Работа только через официальные Open Banking API банков
- Никакого хранения паролей от банков

💬 ТВОЯ РОЛЬ КАК AI-АССИСТЕНТА:
- Помогай пользователям понимать их финансы со всех счетов
- Различай и корректно указывай источник счетов (FinScope, SBank, ABank, VBank)
- Давай персонализированные финансовые советы на основе реальных данных
- Помогай с переводами между счетами
- Объясняй как работает мультибанкинг
- Будь профессиональным финансовым консультантом

⚠️ ВАЖНЫЕ ПРАВИЛА:
- Всегда используй только данные из контекста - не придумывай цифры
- Указывай источник счета (из какого банка) при упоминании
- Отвечай на русском языке грамотно и профессионально
- Если данных нет - честно говори и предлагай решение
- При вопросах о безопасности - объясняй механизм Open Banking
- Мотивируй пользователей подключать больше банков для полной картины`

    if (userContext?.hasAccounts) {
      systemPrompt += `\n\n📊 ПОЛНАЯ ФИНАНСОВАЯ КАРТИНА ПОЛЬЗОВАТЕЛЯ:\n\n💰 СЧЕТА И БАЛАНСЫ:\n• Всего подключено счетов: ${userContext.accountsCount}\n• Счетов в FinScope (локальные): ${userContext.localAccountsCount}\n• Счетов из подключенных банков: ${userContext.multibankAccountsCount}\n• Совокупный баланс: ${userContext.totalBalance.toFixed(2)} RUB\n\nДЕТАЛИ СЧЕТОВ:\n${userContext.accountsList}\n\n💸 ФИНАНСЫ ЗА ТЕКУЩИЙ МЕСЯЦ:\n• Доходы: ${userContext.totalIncome.toFixed(2)} RUB\n• Расходы: ${userContext.totalExpenses.toFixed(2)} RUB\n• Чистый баланс: ${(userContext.totalIncome - userContext.totalExpenses).toFixed(2)} RUB\n• Всего операций: ${userContext.thisMonthTransactionsCount} (из ${userContext.transactionsCount} всего)`
      
      if (userContext.categoriesBreakdown) {
        systemPrompt += `\n\n📊 РАСХОДЫ ПО КАТЕГОРИЯМ:\n${userContext.categoriesBreakdown}`
      }

      if (userContext.hasBudgets) {
        systemPrompt += `\n\n📋 БЮДЖЕТЫ И ЛИМИТЫ:\n${userContext.budgetsList}\n\n• Общий бюджет: ${userContext.totalBudget.toFixed(2)} RUB\n• Потрачено: ${userContext.totalExpenses.toFixed(2)} RUB\n• Осталось: ${(userContext.totalBudget - userContext.totalExpenses).toFixed(2)} RUB\n${userContext.exceededBudgets > 0 ? `⚠️ КРИТИЧНО: Превышено бюджетов: ${userContext.exceededBudgets}` : '✅ Все бюджеты в норме'}`
      }
      
      if (userContext.hasTransactions) {
        systemPrompt += `\n\n📝 ПОСЛЕДНИЕ ОПЕРАЦИИ (ТОП-10):\n${userContext.recentTransactions}`
      }

      systemPrompt += `\n\n💡 ПЕРСОНАЛИЗИРОВАННЫЕ ИНСАЙТЫ:\n${userContext.multibankAccountsCount > 0 ? `✅ Пользователь активно использует мультибанкинг - ${userContext.multibankAccountsCount} подключенных банков!` : '⚠️ Пользователь использует только локальные счета. Предложи подключить банки.'}\n${userContext.hasBudgets ? `✅ Бюджеты настроены${userContext.exceededBudgets > 0 ? `, но есть превышения - дай советы!` : ' - молодец!'}` : '⚠️ Бюджеты не настроены - рекомендуй создать для контроля.'}\n${userContext.totalIncome > 0 && userContext.totalExpenses > 0 ? (userContext.totalIncome > userContext.totalExpenses ? '✅ Положительный баланс - хорошо управляет финансами!' : '⚠️ Расходы превышают доходы - дай рекомендации по оптимизации!') : ''}`
    } else {
      systemPrompt += `\n\n⚠️ СИТУАЦИЯ: У пользователя еще нет счетов.\n\nРЕКОМЕНДАЦИИ:\n1. 🏦 Создать первый счет прямо в FinScope:\n   • Быстро и просто\n   • Полный контроль\n   • Без привязки к банку\n\n2. 🔗 Подключить существующие счета из банков:\n   • Перейти в "Настройки"\n   • Выбрать "Подключенные банки"\n   • Нажать "Подключить новый банк"\n   • Выбрать банк (SBank, ABank, VBank и др.)\n   • Безопасно авторизоваться через банк\n\n3. 🎯 Комбинированный подход (рекомендуется):\n   • Создать основной счет в FinScope\n   • Подключить счета из банков для полной картины\n   • Управлять всеми финансами в одном месте\n\n💡 Объясни преимущества мультибанкинга!`
    }

    // Добавляем контекст с DOM страницы если он есть
    if (pageContext) {
      systemPrompt += `\n\n🖥️ ДАННЫЕ СТРАНИЦЫ (ЧТО ПОЛЬЗОВАТЕЛЬ ВИДИТ ПРЯМО СЕЙЧАС):\n`
      systemPrompt += `📍 Текущая страница: ${pageContext.currentUrl}\n`
      systemPrompt += `📄 Тип страницы: ${pageContext.pageType}\n`

      if (pageContext.totalBalance) {
        systemPrompt += `💰 Общий баланс на странице: ${pageContext.totalBalance} RUB\n`
      }

      if (pageContext.accounts && pageContext.accounts.length > 0) {
        systemPrompt += `\n📊 СЧЕТА НА СТРАНИЦЕ (${pageContext.accounts.length} шт.):\n`
        pageContext.accounts.forEach((acc: any, idx: number) => {
          systemPrompt += `${idx + 1}. ${acc.name}${acc.cardNumber ? ` (${acc.cardNumber})` : ''}: ${acc.balance} ₽\n`
        })
      }

      if (pageContext.transactions && pageContext.transactions.length > 0) {
        systemPrompt += `\n📝 ТРАНЗАКЦИИ НА СТРАНИЦЕ (${pageContext.transactions.length} шт.):\n`
        pageContext.transactions.slice(0, 5).forEach((tx: any, idx: number) => {
          systemPrompt += `${idx + 1}. ${tx.description.substring(0, 80)} - ${tx.amount} ₽\n`
        })
      }

      if (pageContext.budgets && pageContext.budgets.length > 0) {
        systemPrompt += `\n📋 БЮДЖЕТЫ НА СТРАНИЦЕ (${pageContext.budgets.length} шт.):\n`
        pageContext.budgets.forEach((budget: any, idx: number) => {
          systemPrompt += `${idx + 1}. ${budget.category}: ${budget.amount} ₽${budget.percent ? ` (${budget.percent}%)` : ''}\n`
        })
      }

      systemPrompt += `\n⚠️ ВАЖНО: Это данные, которые пользователь видит ПРЯМО СЕЙЧАС на своем экране. Используй их в первую очередь при ответе на вопросы о счетах, балансах и транзакциях!`
    }

    if (!LLM_API_KEY) {
      return NextResponse.json({
        response: generateSmartResponse(message, userContext),
      })
    }

    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      console.error('LLM API Error:', await response.text())
      return NextResponse.json({
        response: generateSmartResponse(message, userContext),
      })
    }

    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content || 'Извините, не могу ответить.'

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error('AI Chat Error:', error)
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    )
  }
}
