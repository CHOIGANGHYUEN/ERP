import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/plants')

export const getPlantList = async (params) => (await apiClient.get('/', { params })).data
export const getPlantDetail = async (id) => (await apiClient.get(`/${id}`)).data
export const savePlant = async (data) => (await apiClient.post('/', data)).data
export const deletePlant = async (id) => (await apiClient.delete(`/${id}`)).data
