import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/logs/user')

export const getUserLogs = async (params = {}) => {
  const response = await apiClient.get('/', { params })
  return response.data
}
