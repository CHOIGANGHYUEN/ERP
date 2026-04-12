import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/units')

export const getUnitList = async (params) => (await apiClient.get('/', { params })).data
export const getUnitDetail = async (id) => (await apiClient.get(`/${id}`)).data
export const saveUnit = async (data) => (await apiClient.post('/', data)).data
export const deleteUnit = async (id) => (await apiClient.delete(`/${id}`)).data
