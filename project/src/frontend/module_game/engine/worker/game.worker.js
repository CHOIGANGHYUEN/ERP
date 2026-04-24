import { World } from '../core/World.js'
import { createSharedBuffers } from '../core/SharedState.js'
import { setupDI } from '../../di/providers/setupDI.js'
import { Logger } from '../utils/Logger.js'

// 워커 전역 에러 핸들러
self.onerror = (message, source, lineno, colno, error) => {
  const isDataCloneError = message.includes('DataCloneError') || error?.name === 'DataCloneError'
  const errorPayload = {
    type: 'ERROR_LOG',
    payload: {
      tag: isDataCloneError ? 'WorkerCrash:Serialization' : 'WorkerGlobal',
      message: isDataCloneError
        ? '⚠️ [DataCloneError] 순환 참조 혹은 직렬화 불가능한 객체가 postMessage로 전송되었습니다. Village/Creature 객체가 직접 전송되지 않았는지 확인하세요.'
        : message,
      source: source,
      lineno: lineno,
      stack: error?.stack,
      time: new Date().toLocaleTimeString(),
    },
  }
  self.postMessage(errorPayload)
}

self.onunhandledrejection = (event) => {
  self.postMessage({
    type: 'ERROR_LOG',
    payload: {
      tag: 'WorkerPromise',
      message: event.reason?.message || 'Unhandled Rejection',
      stack: event.reason?.stack,
      time: new Date().toLocaleTimeString(),
    },
  })
}

// 로거의 워커 전송 콜백 등록
Logger.onWorkerError = (msg) => self.postMessage(msg)

let world = null
const di = setupDI()
let sharedBuffers = null

self.onmessage = (e) => {
  try {
    const { type, payload } = e.data

    if (type === 'INIT') {
      sharedBuffers = payload || createSharedBuffers()

      // DOM 연산 없는 헤드리스 모드로 월드 초기화
      world = new World(di, null, true, sharedBuffers)

      // 워커에서 발생하는 논리 이벤트를 메인 스레드로 전달하는 프록시
      world.onEvent = (msg) => self.postMessage(msg)

      // 메인 스레드에 초기화 완료 알림 및 버퍼 전달
      self.postMessage({ type: 'INIT_BUFFERS', payload: sharedBuffers })

      world.startLogic((_state) => {
        // 상태를 공유 버퍼에 동기화 (Zero-copy)
        world.syncToSharedBuffer()

        // 메인 스레드에 동기화 완료 알림 (데이터는 이미 SAB에 있음)
        self.postMessage({ type: 'SYNC', payload: null })
      })
    } else if (type === 'RETURN_BUFFERS') {
      // SharedArrayBuffer 사용 시 버퍼를 돌려받을 필요가 없으므로 무시하거나 로그만 남김
      // availableBufferSets.push(payload)
    } else if (world) {
      // UI 클릭 등으로 인한 상호작용 프록시 처리
      if (type === 'SPAWN_CREATURE') {
        world.spawnCreature(payload.x, payload.y)
      } else if (type === 'SPAWN_ANIMAL') {
        world.spawnAnimal(payload.x, payload.y, payload.type)
      } else if (type === 'SPAWN_PLANT') {
        world.spawnPlant(payload.x, payload.y, payload.type)
      } else if (type === 'ADD_FERTILITY') {
        world.addFertility(payload.amount)
      } else if (type === 'SET_WEATHER') {
        world.setWeather(payload.type)
      } else if (type === 'SPAWN_TORNADO') {
        world.spawnTornado(payload.x, payload.y)
      } else if (type === 'TRIGGER_EARTHQUAKE') {
        world.triggerEarthquake()
      } else if (type === 'LOAD_CREATURES') {
        world.loadCreatures(payload.creaturesData)
      } else if (type === 'CAMERA_UPDATE') {
        // [SAB] 메인 스레드의 카메라 정보를 워커의 더미 카메라에 동기화
        Object.assign(world.camera, payload)
      } else if (type === 'GET_VILLAGE_DETAILS') {
        // [SAB] 메인 스레드에서 마을의 상세 정보(이름, 인벤토리)를 요청
        const village = world.villages[payload.id] // id는 배열 인덱스
        if (village) {
          self.postMessage({
            type: 'VILLAGE_DETAILS',
            payload: {
              id: payload.id,
              name: village.name,
              inventory: { ...village.inventory },
              nation: village.nation
                ? { id: village.nation.id, name: village.nation.name, color: village.nation.color }
                : null,
            },
          })
        }
      } else if (type === 'GET_NATION_DETAILS') {
        const nation = world.nations.find((n) => n.id === payload.id)
        if (nation) {
          const diplomacy = {}
          for (const [otherNation, relation] of nation.diplomacy.entries()) {
            diplomacy[otherNation.name] = {
              status: relation.status,
              score: Math.round(relation.score),
            }
          }

          const nationInventory = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, knowledge: 0 }
          nation.villages.forEach((v) => {
            nationInventory.food +=
              (v.inventory.food || 0) +
              (v.inventory.biomass || 0) +
              (v.inventory.milk || 0) +
              (v.inventory.meat || 0)
            nationInventory.wood += v.inventory.wood || 0
            nationInventory.stone += v.inventory.stone || 0
            nationInventory.iron += v.inventory.iron || 0
            nationInventory.gold += v.inventory.gold || 0
            nationInventory.knowledge += v.inventory.knowledge || 0
          })

          self.postMessage({
            type: 'NATION_DETAILS',
            payload: {
              id: nation.id,
              name: nation.name,
              diplomacy: diplomacy,
              inventory: nationInventory,
            },
          })
        }
      } else if (type === 'REQUEST_ENTITY_DETAILS') {
        let extInfo = {}
        if (payload.type === 'creature') {
          // 💡 [핵심 버그 수정] payload.id는 메인 스레드 프록시의 배열 인덱스입니다.
          // c.id (문자열)과 payload.id (숫자)를 비교하면 항상 undefined가 반환되어 taskQueue가 비어있게 됩니다.
          const creature = world.creatures[payload.id]
          if (creature) {
            // 💡 [핵심 수정] taskQueue를 UI에 표시할 수 있는 순수 객체로 직렬화
            const serializeTask = (t) => ({
              type: t.type || t.constructor?.name || 'UNKNOWN',
              status: t.status || 'PENDING',
              name: t.name || t.type || '\uc791\uc5c5',
              targetType: t.target?._type || t.target?.type || null,
              targetId: t.target?.id !== undefined ? t.target?.id : null,
            })
            extInfo = {
              inventory: creature.inventory ? { ...creature.inventory } : {},
              taskQueue: creature.taskQueue
                ? creature.taskQueue.map(serializeTask)
                : [],
            }
          }
        }
        self.postMessage({
          type: 'ENTITY_DETAILS',
          payload: {
            id: payload.id,
            _type: payload.type,
            ...extInfo,
          },
        })
      } else if (type === 'GET_WORLD_SAVE_DATA') {
        const worldData = world.creatures.map((c) => ({
          x: c.x,
          y: c.y,
          color: c.color,
          age: c.age,
          profession: c.profession,
        }))
        self.postMessage({
          type: 'WORLD_SAVE_DATA',
          payload: { worldData },
        })
      } else if (type === 'GET_WORLD_INVENTORY') {
        const totalInventory = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, knowledge: 0 }
        world.villages.forEach((v) => {
          // 우유와 고기도 총 식량 수치에 포함시킵니다.
          totalInventory.food +=
            (v.inventory.food || 0) +
            (v.inventory.biomass || 0) +
            (v.inventory.milk || 0) +
            (v.inventory.meat || 0)
          totalInventory.wood += v.inventory.wood || 0
          totalInventory.stone += v.inventory.stone || 0
          totalInventory.iron += v.inventory.iron || 0
          totalInventory.gold += v.inventory.gold || 0
          totalInventory.knowledge += v.inventory.knowledge || 0
        })
        self.postMessage({
          type: 'WORLD_INVENTORY_DETAILS',
          payload: totalInventory,
        })
      }
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR_LOG',
      payload: {
        tag: 'WorkerOnMessage',
        message: error.message,
        stack: error.stack,
        time: new Date().toLocaleTimeString(),
      },
    })
  }
}
