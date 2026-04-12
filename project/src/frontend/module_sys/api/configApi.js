import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/configs')

export const getConfigs = async (params) => {
  const response = await apiClient.get('/', { params })
  return response.data
}

export const getConfigDetail = async (id) => {
  const response = await apiClient.get(`/${id}`)
  return response.data
}

export const saveConfig = async (data) => {
  const response = await apiClient.post('/', data)
  return response.data
}

export const updateConfig = async (id, data) => {
  const response = await apiClient.put(`/${id}`, data)
  return response.data
}

export const deleteConfig = async (id) => {
  const response = await apiClient.delete(`/${id}`)
  return response.data
}
