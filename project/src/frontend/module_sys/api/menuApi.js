import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/menus')

export const getMenus = async (params) => {
  const response = await apiClient.get('/', { params })
  return response.data
}

export const getMenuDetail = async (id) => {
  const response = await apiClient.get(`/${id}`)
  return response.data
}

export const saveMenu = async (data) => {
  const response = await apiClient.post('/', data)
  return response.data
}

export const updateMenu = async (id, data) => {
  const response = await apiClient.put(`/${id}`, data)
  return response.data
}

export const deleteMenu = async (id) => {
  const response = await apiClient.delete(`/${id}`)
  return response.data
}
