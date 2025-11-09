# Dockerfile для Next.js Frontend
FROM node:18-alpine

# Установка зависимостей
RUN apk add --no-cache libc6-compat

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Генерация Prisma Client
RUN npx prisma generate

# Сборка приложения
RUN npm run build

# Открытие порта
EXPOSE 3000

# Запуск приложения
CMD ["npm", "start"]