import { createApiClient } from '@/frontend/common/utils/apiClient'
const apiClient = createApiClient('/api/game')

export const saveWorld = (data) => {
  return apiClient.post('/world', data)
}

export const loadWorlds = () => {
  return apiClient.get('/worlds')
}

export const summonCreature = (data) => {
  return apiClient.post('/summon', data)
}

export const getEnvironmentStatus = (worldId) => {
  return apiClient.get(`/status/environment/${worldId}`)
}

export const getCreatureStatus = (creatureId) => {
  return apiClient.get(`/status/creature/${creatureId}`)
}

export const getOverallStatus = (worldId) => {
  return apiClient.get(`/status/overall/${worldId}`)
}
