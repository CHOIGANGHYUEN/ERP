import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/logs/login')

export const getLoginLogs = async (params = {}) => {
  const response = await apiClient.get('/', { params })
  return response.data
}
