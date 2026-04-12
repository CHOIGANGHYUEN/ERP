import { createApiClient } from '@/frontend/common/utils/apiClient.js'

const apiClient = createApiClient('/api/sys/tablespecs')

export const getTableList = async (params = {}) => {
  const response = await apiClient.get('/', { params: { langu: 'KO', ...params } })
  return response.data
}

export const getTableDetail = async (tablen, langu = 'KO') => {
  const response = await apiClient.get(`/${tablen}`, { params: { langu } })
  return response.data
}

export const saveTableSpec = async (data) => {
  const response = await apiClient.post('/', data)
  return response.data
}
// 기존 api 파일에 아래 두 함수 추가
export const getInsertSql = async (tablen) => {
  const response = await apiClient.get(`/${tablen}/sql/insert`)
  return response.data
}

export const getUpdateSql = async (tablen) => {
  const response = await apiClient.get(`/${tablen}/sql/update`)
  return response.data
}

export const generateSql = async (tablen) => {
  const response = await apiClient.post(`/${tablen}/generate-sql`)
  return response.data
}

export const executeSqlScript = async (tablen, sql) => {
  const response = await apiClient.post(`/${tablen}/execute-sql`, { sql })
  return response.data
}
