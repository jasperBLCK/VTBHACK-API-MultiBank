/**
 * Скрипт для проверки доступности backend
 * Запуск: node check-backend.js
 */

const http = require('http');

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const url = new URL(BACKEND_URL);

console.log(`🔍 Проверка доступности backend: ${BACKEND_URL}`);

const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: '/health',
  method: 'GET',
  timeout: 5000,
};

const req = http.request(options, (res) => {
  console.log(`✅ Backend доступен! Статус: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('📊 Ответ backend:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('📄 Ответ backend:', data);
    }
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка подключения к backend:');
  console.error(`   ${error.message}`);
  console.error('');
  console.error('💡 Решение:');
  console.error('   1. Убедитесь что backend запущен: python run.py');
  console.error(`   2. Проверьте что backend слушает на ${url.hostname}:${url.port}`);
  console.error('   3. Проверьте настройки в env.txt и FrontendN/.env.local');
  process.exit(1);
});

req.on('timeout', () => {
  console.error('⏱️  Таймаут при подключении к backend');
  req.destroy();
  process.exit(1);
});

req.end();

