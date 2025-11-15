import axios from 'axios'

const VTB_API_URL = process.env.NEXT_PUBLIC_VTB_API_URL || 'https://api.vtb.ru'
const VTB_CLIENT_ID = process.env.NEXT_PUBLIC_VTB_CLIENT_ID
const VTB_CLIENT_SECRET = process.env.NEXT_PUBLIC_VTB_CLIENT_SECRET

interface VTBTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

class VTBApiClient {
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  private async getAccessToken(): Promise<string> {
    // Если токен еще действителен, возвращаем его
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    // Получаем новый токен
    try {
      if (!VTB_CLIENT_ID || !VTB_CLIENT_SECRET) {
        throw new Error('VTB API credentials not configured')
      }

      const response = await axios.post<VTBTokenResponse>(
        `${VTB_API_URL}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: VTB_CLIENT_ID,
          client_secret: VTB_CLIENT_SECRET,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 секунд таймаут
        }
      )

      if (!response.data.access_token) {
        throw new Error('Invalid token response')
      }

      this.accessToken = response.data.access_token
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000 // -1 минута для запаса

      return this.accessToken
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('Неверные учетные данные VTB API')
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('Превышено время ожидания ответа от VTB API')
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new Error('VTB API недоступен')
        }
        throw new Error(`Ошибка VTB API: ${error.response?.status} ${error.response?.statusText}`)
      }
      console.error('Ошибка получения токена ВТБ:', error)
      throw error instanceof Error ? error : new Error('Неизвестная ошибка при получении токена')
    }
  }

  async getAccounts() {
    try {
      const token = await this.getAccessToken()
      
      const response = await axios.get(`${VTB_API_URL}/api/v1/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      })
      
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          // Токен истек, сбрасываем его и пробуем снова
          this.accessToken = null
          this.tokenExpiry = 0
          const token = await this.getAccessToken()
          const retryResponse = await axios.get(`${VTB_API_URL}/api/v1/accounts`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 10000,
          })
          return retryResponse.data
        }
        if (error.response?.status === 429) {
          throw new Error('Превышен лимит запросов к VTB API. Попробуйте позже.')
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('Ошибка сервера VTB API. Попробуйте позже.')
        }
        const status = error.response?.status || 'unknown'
        const statusText = error.response?.statusText || 'unknown'
        throw new Error(`Ошибка получения счетов: ${status} ${statusText}`)
      }
      console.error('Ошибка получения счетов ВТБ:', error)
      throw error instanceof Error ? error : new Error('Неизвестная ошибка при получении счетов')
    }
  }

  async getTransactions(accountId: string, fromDate?: Date, toDate?: Date) {
    try {
      const token = await this.getAccessToken()
      
      const params: any = {}
      if (fromDate) params.from = fromDate.toISOString()
      if (toDate) params.to = toDate.toISOString()

      const response = await axios.get(
        `${VTB_API_URL}/api/v1/accounts/${accountId}/transactions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params,
          timeout: 10000,
        }
      )
      
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          this.accessToken = null
          this.tokenExpiry = 0
          const token = await this.getAccessToken()
          const params: any = {}
          if (fromDate) params.from = fromDate.toISOString()
          if (toDate) params.to = toDate.toISOString()
          const retryResponse = await axios.get(
            `${VTB_API_URL}/api/v1/accounts/${accountId}/transactions`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              params,
              timeout: 10000,
            }
          )
          return retryResponse.data
        }
        if (error.response?.status === 404) {
          throw new Error('Счет не найден')
        }
        if (error.response?.status === 429) {
          throw new Error('Превышен лимит запросов к VTB API. Попробуйте позже.')
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('Ошибка сервера VTB API. Попробуйте позже.')
        }
        const status = error.response?.status || 'unknown'
        const statusText = error.response?.statusText || 'unknown'
        throw new Error(`Ошибка получения транзакций: ${status} ${statusText}`)
      }
      console.error('Ошибка получения транзакций ВТБ:', error)
      throw error instanceof Error ? error : new Error('Неизвестная ошибка при получении транзакций')
    }
  }

  async getBalance(accountId: string) {
    try {
      const token = await this.getAccessToken()
      
      const response = await axios.get(
        `${VTB_API_URL}/api/v1/accounts/${accountId}/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      )
      
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          this.accessToken = null
          this.tokenExpiry = 0
          const token = await this.getAccessToken()
          const retryResponse = await axios.get(
            `${VTB_API_URL}/api/v1/accounts/${accountId}/balance`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              timeout: 10000,
            }
          )
          return retryResponse.data
        }
        if (error.response?.status === 404) {
          throw new Error('Счет не найден')
        }
        if (error.response?.status === 429) {
          throw new Error('Превышен лимит запросов к VTB API. Попробуйте позже.')
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('Ошибка сервера VTB API. Попробуйте позже.')
        }
        const status = error.response?.status || 'unknown'
        const statusText = error.response?.statusText || 'unknown'
        throw new Error(`Ошибка получения баланса: ${status} ${statusText}`)
      }
      console.error('Ошибка получения баланса ВТБ:', error)
      throw error instanceof Error ? error : new Error('Неизвестная ошибка при получении баланса')
    }
  }
}

export const vtbApi = new VTBApiClient()

