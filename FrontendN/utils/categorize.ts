// Утилиты для категоризации транзакций на основе ключевых слов (простая ML-категоризация)

import { Transaction } from '@/types'

// Словари ключевых слов для категоризации
const categoryKeywords: Record<string, string[]> = {
  food: [
    'ресторан', 'кафе', 'макдональдс', 'kfc', 'бургер', 'пицца', 'суши', 'доставка',
    'продукты', 'магнит', 'пятерочка', 'ашан', 'перекресток', 'лента', 'спар',
    'мясо', 'рыба', 'овощи', 'фрукты', 'молочные', 'хлеб', 'выпечка', 'кофе', 'чай',
    'starbucks', 'кофейня', 'столовая', 'кафетерий', 'food', 'eat', 'restaurant'
  ],
  transport: [
    'метро', 'автобус', 'троллейбус', 'трамвай', 'такси', 'uber', 'яндекс такси',
    'яндекс.го', 'каршеринг', 'delimobil', 'belkacar', 'yandex drive',
    'заправка', 'азс', 'бензин', 'газ', 'парковка', 'штраф', 'госпошлина',
    'автомойка', 'шиномонтаж', 'транспорт', 'transport', 'taxi', 'fuel', 'gas'
  ],
  shopping: [
    'магазин', 'покупка', 'купить', 'заказ', 'ozon', 'wildberries', 'яндекс.маркет',
    'алиэкспресс', 'аймолл', 'днс', 'м.видео', 'эльдорадо', 'мегафон', 'билайн',
    'теле2', 'мтс', 'одежда', 'обувь', 'электроника', 'техника', 'аксессуары',
    'косметика', 'парфюмерия', 'shopping', 'shop', 'store', 'buy', 'purchase'
  ],
  bills: [
    'коммунальные', 'жкх', 'квартплата', 'электричество', 'газ', 'вода', 'отопление',
    'интернет', 'телефон', 'телевидение', 'кабельное', 'подписка', 'netflix', 'spotify',
    'яндекс.плюс', 'okko', 'ivi', 'мегафон', 'мтс', 'билайн', 'теле2',
    'страхование', 'кредит', 'ипотека', 'аренда', 'bills', 'utility', 'rent', 'insurance'
  ],
  income: [
    'зарплата', 'перевод', 'доход', 'премия', 'бонус', 'возврат', 'refund',
    'salary', 'income', 'payment received', 'перевод на счет'
  ],
  entertainment: [
    'кино', 'театр', 'концерт', 'игры', 'steam', 'playstation', 'xbox',
    'развлечения', 'отдых', 'отпуск', 'путешествие', 'билет', 'отель', 'hotel',
    'entertainment', 'cinema', 'theater', 'game', 'travel', 'vacation'
  ],
  health: [
    'аптека', 'лекарство', 'врач', 'поликлиника', 'больница', 'стоматолог',
    'медицина', 'здоровье', 'спорт', 'тренажерный', 'фитнес', 'pharmacy', 'doctor',
    'hospital', 'medicine', 'health', 'fitness', 'gym'
  ],
  education: [
    'образование', 'университет', 'школа', 'курсы', 'обучение', 'книга', 'учебник',
    'education', 'university', 'school', 'course', 'book'
  ],
}

/**
 * Категоризация транзакции на основе описания
 */
export function categorizeTransaction(description: string, amount: number): Transaction['category'] {
  const lowerDescription = description.toLowerCase()
  
  // Определяем, является ли транзакция доходом (положительная сумма)
  if (amount > 0) {
    // Проверяем ключевые слова дохода
    for (const keyword of categoryKeywords.income) {
      if (lowerDescription.includes(keyword)) {
        return 'income'
      }
    }
    return 'income' // По умолчанию положительная сумма - доход
  }

  // Для расходов проверяем категории по ключевым словам
  const categoryScores: Record<string, number> = {
    food: 0,
    transport: 0,
    shopping: 0,
    bills: 0,
    entertainment: 0,
    health: 0,
    education: 0,
  }

  // Подсчитываем совпадения для каждой категории
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === 'income') continue
    
    for (const keyword of keywords) {
      if (lowerDescription.includes(keyword)) {
        categoryScores[category as keyof typeof categoryScores]++
      }
    }
  }

  // Находим категорию с наибольшим количеством совпадений
  const maxScore = Math.max(...Object.values(categoryScores))
  if (maxScore > 0) {
    const bestCategory = Object.entries(categoryScores).find(([_, score]) => score === maxScore)?.[0]
    if (bestCategory && bestCategory in categoryScores) {
      return bestCategory as Transaction['category']
    }
  }

  return 'other'
}

/**
 * Автоматическая категоризация всех транзакций
 */
export function categorizeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map(transaction => {
    // Если категория уже установлена, не меняем её
    if (transaction.category && transaction.category !== 'other') {
      return transaction
    }

    const category = categorizeTransaction(transaction.description, transaction.amount)
    return {
      ...transaction,
      category,
    }
  })
}

/**
 * Обучение категоризации на основе пользовательских меток
 */
export function learnFromUserChoice(
  description: string,
  userCategory: Transaction['category'],
  categoryKeywords: Record<string, string[]>
) {
  // Извлекаем ключевые слова из описания
  const words = description.toLowerCase().split(/\s+/).filter(word => word.length > 3)
  
  // Добавляем новые ключевые слова в категорию (в реальности это сохранялось бы в БД)
  if (!categoryKeywords[userCategory]) {
    categoryKeywords[userCategory] = []
  }
  
  words.forEach(word => {
    if (!categoryKeywords[userCategory].includes(word)) {
      categoryKeywords[userCategory].push(word)
    }
  })
  
  return categoryKeywords
}

