/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    VTB_API_URL: process.env.VTB_API_URL || 'https://api.vtb.ru',
    VTB_CLIENT_ID: process.env.VTB_CLIENT_ID,
    VTB_CLIENT_SECRET: process.env.VTB_CLIENT_SECRET,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001',
  },
  // Отключаем статическую оптимизацию для динамических маршрутов
  output: 'standalone',
}

module.exports = nextConfig

