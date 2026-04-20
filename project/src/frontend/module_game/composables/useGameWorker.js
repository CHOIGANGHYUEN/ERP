import { ref, onBeforeUnmount, markRaw, shallowRef } from 'vue'
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

  // [Optimization] 시뮬레이션 데이터(개체, 마을 등)는 구조가 크고 양방향 참조가 있을 수 있으므로
  // shallowRef와 markRaw를 사용하여 Vue의 Deep Reactivity 추적(병목의 원인)을 방지합니다.
  const selectedEntityData = shallowRef(null)
  const worldInventory = shallowRef(null)
  const chatLogs = shallowRef([])
  const saveResolve = ref(null)

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

      selectedEntityData.value = markRaw({
        ...selectedEntityData.value,
        ...bufferedData,
        name: preservedName || bufferedData.name,
        inventory:
          preservedInventory && Object.keys(preservedInventory).length > 0
            ? preservedInventory
            : bufferedData.inventory,
        nation: preservedNation || bufferedData.nation,
      })
      worldInstance.onProxyAction({ type: 'GET_VILLAGE_DETAILS', payload: { id: ent.id } })
    } else {
      selectedEntityData.value = markRaw(bufferedData)
      if (bufferedData.isVillage) {
        worldInstance.onProxyAction({ type: 'GET_VILLAGE_DETAILS', payload: { id: ent.id } })
      }
    }
  }

  const initWorker = () => {
    if (!gameCanvas.value) return

    // [Lifecycle Security] 기존 실행 중인 워커와 인터벌이 있다면 즉시 종료 (Zombie Worker 방지)
    if (gameWorker) {
      console.warn('[useGameWorker] 기존 워커 인스턴스를 발견하여 종료합니다.')
      gameWorker.terminate()
      gameWorker = null
    }
    if (popInterval) {
      clearInterval(popInterval)
      popInterval = null
    }

    try {
      gameWorker = new Worker(new URL('../engine/worker/game.worker.js', import.meta.url), {
        type: 'module',
      })
    } catch (e) {
      console.error('[useGameWorker] 워커 생성 실패:', e)
      return
    }
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
        // [SAB] 초기 버퍼 참조 동기화
        if (payload) worldInstance.initSharedState(payload)
        worldInstance.start()
      } else if (type === 'SYNC') {
        // [SAB] Zero-copy 환경에서는 payload가 null이므로 무시
        // 만약 Transferable 구조라면 전달된 버퍼로 상태 초기화
        if (payload) {
          worldInstance.initSharedState(payload)
          // 구버퍼를 워커로 반환 (Double buffering 지원 시)
          gameWorker.postMessage({ type: 'RETURN_BUFFERS', payload })
        }
      } else if (type === 'VILLAGE_DETAILS') {
        if (selectedEntityData.value && selectedEntityData.value.id === payload.id) {
          selectedEntityData.value = markRaw({ ...selectedEntityData.value, ...payload })
          if (payload.nation) {
            worldInstance.onProxyAction({
              type: 'GET_NATION_DETAILS',
              payload: { id: payload.nation.id },
            })
          }
        }
      } else if (type === 'ENTITY_DETAILS') {
        if (selectedEntityData.value && selectedEntityData.value.id === payload.id) {
          selectedEntityData.value = markRaw({ ...selectedEntityData.value, ...payload })
        }
      } else if (type === 'NATION_DETAILS') {
        if (selectedEntityData.value?.nation?.id === payload.id) {
          selectedEntityData.value = markRaw({
            ...selectedEntityData.value,
            nation: { ...selectedEntityData.value.nation, ...payload },
          })
        }
      } else if (type === 'WORLD_INVENTORY_DETAILS') {
        worldInventory.value = markRaw(payload)
      } else if (type === 'SPEECH_BUBBLE' || type === 'SYSTEM_MESSAGE') {
        const timeStr = new Date().toLocaleTimeString('ko-KR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        const isBubble = type === 'SPEECH_BUBBLE'
        if (isBubble) {
          worldInstance.showSpeechBubble(
            payload.entityId,
            payload.entityType,
            payload.text,
            payload.duration,
          )
        }

        const newLog = {
          time: timeStr,
          sender: isBubble
            ? payload.entityType === 'creature'
              ? `주민 ${payload.entityId || ''}`
              : '시스템'
            : '시스템 알림',
          text: payload.text,
          color: payload.color || (isBubble ? '#ecf0f1' : '#f1c40f'),
        }
        // 💡 [병목 개선] 배열 전개 연산자(...)를 계속 생성하는 대신 기존 배열에 push 후 슬라이싱
        chatLogs.value.push(newLog)
        if (chatLogs.value.length > 100) chatLogs.value.shift()
        chatLogs.value = chatLogs.value.slice() // 반응형 갱신용 얕은 복사
      } else if (type === 'ERROR_LOG') {
        const timeStr = payload.time || new Date().toLocaleTimeString()
        const newLog = {
          time: timeStr,
          sender: `⚠️ ERROR [${payload.tag}]`,
          text: payload.message,
          color: '#e74c3c', // 빨간색 에러 표시
        }
        chatLogs.value.push(newLog)
        if (chatLogs.value.length > 100) chatLogs.value.shift()
        chatLogs.value = chatLogs.value.slice()
        console.error(`[Worker Error - ${payload.tag}]`, payload.message, payload.stack)
      } else if (type === 'WORLD_SAVE_DATA') {
        if (saveResolve.value) {
          saveResolve.value(payload.worldData)
          saveResolve.value = null
        }
      }
    }

    gameWorker.postMessage({ type: 'INIT' })

    popInterval = setInterval(() => {
      if (worldInstance && worldInstance.views && worldInstance.views.globals) {
        const globals = worldInstance.views.globals
        population.value = globals[INDEX_CREATURE_COUNT]
        fertility.value = globals[INDEX_FERTILITY]
        maxFertility.value = worldInstance.maxFertility
        const seasonMap = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER']
        season.value = seasonMap[globals[INDEX_SEASON]] || 'SPRING'
        zoomLevel.value = Math.round((worldInstance.camera.zoom || 1) * 100)
        const hours = Math.floor(globals[INDEX_TIME_OF_DAY] / 1000)
          .toString()
          .padStart(2, '0')
        displayTime.value = `${hours}:00`
        updateSelectedEntityData() // Sync selected entity info continuously
      }
    }, 200)
  }

  const requestWorldSaveData = () => {
    return new Promise((resolve) => {
      if (!gameWorker) {
        resolve([])
        return
      }
      saveResolve.value = resolve
      gameWorker.postMessage({ type: 'GET_WORLD_SAVE_DATA' })
    })
  }

  onBeforeUnmount(() => {
    if (worldInstance) {
      worldInstance.destroy()
      worldInstanceReady.value = false
      worldInstance = null
    }
    if (gameWorker) {
      gameWorker.terminate()
      gameWorker = null
    }
    if (popInterval) {
      clearInterval(popInterval)
      popInterval = null
    }
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
    mapHeight,
    requestWorldSaveData,
  }
}
