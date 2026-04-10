import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/sys/tablespecs',
  withCredentials: true,
})

export const getTableList = async (langu = 'EN') => {
  const response = await apiClient.get('/', { params: { langu } })
  return response.data
}

export const getTableDetail = async (tablen, langu = 'EN') => {
  const response = await apiClient.get(`/${tablen}`, { params: { langu } })
  return response.data
}

export const saveTableSpec = async (data) => {
  const response = await apiClient.post('/', data)
  return response.data
}

export const generateSql = async (tablen) => {
  const response = await apiClient.post(`/${tablen}/generate-sql`)
  return response.data
}
