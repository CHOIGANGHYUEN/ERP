import axios from 'axios'

export const createApiClient = (baseURL) => {
  const client = axios.create({
    baseURL,
    withCredentials: true,
  })

  client.interceptors.request.use((config) => {
    const menuId = localStorage.getItem('currentMenuId')
    if (menuId) {
      config.headers['x-menu-id'] = menuId
    }
    return config
  })

  return client
}
