import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/codes')

export const getCodeHeads = async (params = {}) => {
  const response = await apiClient.get('/', { params })
  return response.data
}

export const getCodeHeadDetail = async (categoryCode, groupCode) => {
  const response = await apiClient.get(`/${categoryCode}/${groupCode}`)
  return response.data
}

export const saveCodeGroup = async (data) => {
  const response = await apiClient.post('/', data)
  return response.data
}

export const deleteCodeGroup = async (categoryCode, groupCode) => {
  const response = await apiClient.delete(`/${categoryCode}/${groupCode}`)
  return response.data
}
