import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/users')

export const getUsers = async (params = {}) => {
  const response = await apiClient.get('/', { params })
  return response.data
}

export const getUserDetail = async (id) => {
  const response = await apiClient.get(`/${id}`)
  return response.data
}

export const saveUser = async (data) => {
  const response = await apiClient.post('/', data)
  return response.data
}

export const deleteUser = async (id) => {
  const response = await apiClient.delete(`/${id}`)
  return response.data
}
