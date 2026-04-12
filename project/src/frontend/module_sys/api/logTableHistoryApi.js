import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/logs/table-history')

export const getTableHistoryLogs = async (params = {}) => {
  const response = await apiClient.get('/', { params })
  return response.data
}
