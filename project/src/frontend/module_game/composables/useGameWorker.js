import { ref, onBeforeUnmount } from 'vue'
import { World } from '../engine/core/World.js'
import { setupDI } from '../di/providers/setupDI.js'

// Shared buffer indices mappings
const INDEX_CREATURE_COUNT = 0
const INDEX_FERTILITY = 8
const INDEX_TIME_OF_DAY = 9
const INDEX_SEASON = 10

export function useGameWorker(gameCanvas) {
  let gameWorker = null
  let popInterval = null
  let worldInstance = null

  const worldInstanceReady = ref(false)
  const population = ref(0)
  const fertility = ref(0)
  const maxFertility = ref(0)
  const season = ref('SPRING')
  const displayTime = ref('08:00')
  const zoomLevel = ref(100)
  const mapWidth = ref(0)
  const mapHeight = ref(0)

  const selectedEntityData = ref(null)
  const worldInventory = ref(null)
  const chatLogs = ref([])

  const getWorldInstance = () => worldInstance

  const updateSelectedEntityData = () => {
    const ent = worldInstance?.selectedEntity
    if (!worldInstance || !ent) {
      selectedEntityData.value = null
      return
    }

    const bufferedData = worldInstance.getDataFromBuffer(ent._type, ent.id)
    if (!bufferedData || bufferedData.isDead) {
      worldInstance.selectedEntity = null
      selectedEntityData.value = null
      return
    }

    if (bufferedData.isVillage && selectedEntityData.value?.id === bufferedData.id) {
      const preservedName = selectedEntityData.value.name
      const preservedInventory = selectedEntityData.value.inventory
      const preservedNation = selectedEntityData.value.nation

      selectedEntityData.value = {
        ...selectedEntityData.value,
        ...bufferedData,
        name: preservedName || bufferedData.name,
        inventory:
          preservedInventory && Object.keys(preservedInventory).length > 0
            ? preservedInventory
            : bufferedData.inventory,
        nation: preservedNation || bufferedData.nation,
      }
      worldInstance.onProxyAction({ type: 'GET_VILLAGE_DETAILS', payload: { id: ent.id } })
    } else {
      selectedEntityData.value = bufferedData
      if (bufferedData.isVillage) {
        worldInstance.onProxyAction({ type: 'GET_VILLAGE_DETAILS', payload: { id: ent.id } })
      }
    }
  }

  const initWorker = () => {
    if (!gameCanvas.value) return

    gameWorker = new Worker(new URL('../engine/worker/game.worker.js', import.meta.url), {
      type: 'module',
    })
    worldInstance = new World(setupDI(), gameCanvas.value)
    worldInstanceReady.value = true
    mapWidth.value = worldInstance.width
    mapHeight.value = worldInstance.height

    worldInstance.onProxyAction = (msg) => {
      gameWorker.postMessage(msg)
    }

    gameWorker.onmessage = (e) => {
      const { type, payload } = e.data
      if (type === 'INIT_BUFFERS') {
        worldInstance.start()
      } else if (type === 'SYNC') {
        const oldBuffers = worldInstance.sharedBuffers
        worldInstance.initSharedState(payload)
        if (oldBuffers) {
          const transferList = Object.values(oldBuffers)
          gameWorker.postMessage({ type: 'RETURN_BUFFERS', payload: oldBuffers }, transferList)
        }
      } else if (type === 'VILLAGE_DETAILS') {
        if (selectedEntityData.value && selectedEntityData.value.id === payload.id) {
          selectedEntityData.value = { ...selectedEntityData.value, ...payload }
          if (payload.nation) {
            worldInstance.onProxyAction({
              type: 'GET_NATION_DETAILS',
              payload: { id: payload.nation.id },
            })
          }
        }
      } else if (type === 'ENTITY_DETAILS') {
        if (selectedEntityData.value && selectedEntityData.value.id === payload.id) {
          selectedEntityData.value = { ...selectedEntityData.value, ...payload }
        }
      } else if (type === 'NATION_DETAILS') {
        if (selectedEntityData.value?.nation?.id === payload.id) {
          selectedEntityData.value = { ...selectedEntityData.value, nation: { ...selectedEntityData.value.nation, ...payload } }
        }
      } else if (type === 'WORLD_INVENTORY_DETAILS') {
        worldInventory.value = payload
      } else if (type === 'SPEECH_BUBBLE' || type === 'SYSTEM_MESSAGE') {
        const timeStr = new Date().toLocaleTimeString('ko-KR', {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
        const isBubble = type === 'SPEECH_BUBBLE'
        if (isBubble) {
          worldInstance.showSpeechBubble(payload.entityId, payload.entityType, payload.text, payload.duration)
        }
        chatLogs.value.push({
          time: timeStr,
          sender: isBubble ? (payload.entityType === 'creature' ? `주민 ${payload.entityId || ''}` : '시스템') : '시스템 알림',
          text: payload.text,
          color: payload.color || (isBubble ? '#ecf0f1' : '#f1c40f'),
        })
        if (chatLogs.value.length > 500) chatLogs.value.shift()
      } else if (type === 'ERROR_LOG') {
        const timeStr = payload.time || new Date().toLocaleTimeString()
        chatLogs.value.push({
          time: timeStr,
          sender: `⚠️ ERROR [${payload.tag}]`,
          text: payload.message,
          color: '#e74c3c' // 빨간색 에러 표시
        })
        if (chatLogs.value.length > 500) chatLogs.value.shift()
        console.error(`[Worker Error - ${payload.tag}]`, payload.message, payload.stack)
      }
    }

    gameWorker.postMessage({ type: 'INIT' })

    popInterval = setInterval(() => {
      if (worldInstance && worldInstance.views) {
        const globals = worldInstance.views.globals
        population.value = globals[INDEX_CREATURE_COUNT]
        fertility.value = globals[INDEX_FERTILITY]
        maxFertility.value = worldInstance.maxFertility
        const seasonMap = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER']
        season.value = seasonMap[globals[INDEX_SEASON]] || 'SPRING'
        zoomLevel.value = Math.round((worldInstance.camera.zoom || 1) * 100)
        const hours = Math.floor(globals[INDEX_TIME_OF_DAY] / 1000).toString().padStart(2, '0')
        displayTime.value = `${hours}:00`
        updateSelectedEntityData() // Sync selected entity info continuously
      }
    }, 200)
  }

  onBeforeUnmount(() => {
    if (gameWorker) gameWorker.terminate()
    if (popInterval) clearInterval(popInterval)
  })

  return {
    worldInstanceReady,
    getWorldInstance,
    initWorker,
    selectedEntityData,
    worldInventory,
    chatLogs,
    population,
    fertility,
    maxFertility,
    season,
    displayTime,
    zoomLevel,
    mapWidth,
    mapHeight
  }
}
