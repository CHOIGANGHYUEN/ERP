import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/sys/roles',
  withCredentials: true,
})

export const getRoles = async (params) => {
  const response = await apiClient.get('/', { params })
  return response.data
}

export const getRoleDetail = async (id) => {
  const response = await apiClient.get(`/${id}`)
  return response.data
}

export const saveRole = async (data) => {
  const response = await apiClient.post('/', data)
  return response.data
}

export const updateRole = async (id, data) => {
  const response = await apiClient.put(`/${id}`, data)
  return response.data
}

export const deleteRole = async (id) => {
  const response = await apiClient.delete(`/${id}`)
  return response.data
}

export const getRoleMenus = async (id) => {
  const response = await apiClient.get(`/${id}/menus`)
  return response.data
}

export const updateRoleMenus = async (id, menuIds) => {
  const response = await apiClient.post(`/${id}/menus`, { menuIds })
  return response.data
}

export const getRoleUsers = async (id) => {
  const response = await apiClient.get(`/${id}/users`)
  return response.data
}

export const updateRoleUsers = async (id, userIds) => {
  const response = await apiClient.post(`/${id}/users`, { userIds })
  return response.data
}
