import { World } from '../core/World.js'
import { createSharedBuffers } from '../core/SharedState.js'
import { setupDI } from '../../di/providers/setupDI.js'
import { Logger } from '../utils/Logger.js'

// 워커 전역 에러 핸들러
self.onerror = (message, source, lineno, colno, error) => {
  const errorPayload = {
    type: 'ERROR_LOG',
    payload: {
      tag: 'WorkerGlobal',
      message: message,
      source: source,
      lineno: lineno,
      stack: error?.stack,
      time: new Date().toLocaleTimeString()
    }
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
      time: new Date().toLocaleTimeString()
    }
  })
}

// 로거의 워커 전송 콜백 등록
Logger.onWorkerError = (msg) => self.postMessage(msg)

let world = null
const di = setupDI()
let availableBufferSets = []

self.onmessage = (e) => {
  const { type, payload } = e.data

  if (type === 'INIT') {
    availableBufferSets.push(createSharedBuffers())
    availableBufferSets.push(createSharedBuffers()) // Double buffering

    // DOM 연산 없는 헤드리스 모드로 월드 초기화
    world = new World(di, null, true, availableBufferSets[0])

    // 워커에서 발생하는 논리 이벤트를 메인 스레드로 전달하는 프록시
    world.onEvent = (msg) => self.postMessage(msg)

    // 메인 스레드에 초기화 완료 알림
    self.postMessage({ type: 'INIT_BUFFERS', payload: null })

    world.startLogic((_state) => {
      // 가용한 버퍼가 없으면(메인 스레드가 아직 처리를 못했으면) 동기화 생략
      if (!world.views || availableBufferSets.length === 0) return

      // 상태를 현재 버퍼에 동기화
      world.syncToSharedBuffer()

      // [Transferable] 메인 스레드로 소유권 이전
      const currentBufferSet = availableBufferSets.shift()
      const transferList = Object.values(currentBufferSet)
      
      self.postMessage({ type: 'SYNC', payload: currentBufferSet }, transferList)

      // 다음 프레임을 위한 버퍼 준비
      if (availableBufferSets.length > 0) {
        world.initSharedState(availableBufferSets[0])
      } else {
        world.views = null // 돌려받을 때까지 버퍼 없음
      }
    })
  } else if (type === 'RETURN_BUFFERS') {
    // [Transferable] 메인 스레드에서 사용 완료된 버퍼를 돌려받음
    availableBufferSets.push(payload)
    if (!world.views) {
      world.initSharedState(payload)
    }
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
        const creature = world.creatures.find(c => c.id === payload.id)
        if (creature) {
          extInfo = {
            inventory: creature.inventory ? { ...creature.inventory } : {},
            taskQueue: creature.taskQueue ? creature.taskQueue.map(t => ({ type: t.type, status: t.status })) : []
          }
        }
      }
      self.postMessage({
        type: 'ENTITY_DETAILS',
        payload: {
          id: payload.id,
          ...extInfo
        }
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
}
