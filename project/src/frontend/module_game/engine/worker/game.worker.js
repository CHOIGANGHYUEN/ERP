import { World } from '../core/World.js'
import { createSharedBuffers } from '../core/SharedState.js'
import { setupDI } from '../../di/providers/setupDI.js'

let world = null
const di = setupDI()

self.onmessage = (e) => {
  const { type, payload } = e.data

  if (type === 'INIT') {
    const sharedBuffers = createSharedBuffers()

    // DOM 연산 없는 헤드리스 모드로 월드 초기화
    world = new World(di, null, true, sharedBuffers)

    // 워커에서 발생하는 논리 이벤트를 메인 스레드로 전달하는 프록시
    world.onEvent = (msg) => self.postMessage(msg)

    // [SAB] 메인 스레드로 버퍼를 전송합니다. SharedArrayBuffer는 복사되지 않고 공유됩니다.
    self.postMessage({ type: 'INIT_BUFFERS', payload: sharedBuffers })

    world.startLogic((_state) => {
      // [SAB] 상태를 버퍼에 동기화
      world.syncToSharedBuffer()
      // [SAB] 메인 스레드에 렌더링 신호만 전송
      self.postMessage({ type: 'SYNC' })
    })
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
        self.postMessage({
          type: 'NATION_DETAILS',
          payload: {
            id: nation.id,
            name: nation.name,
            diplomacy: diplomacy,
          },
        })
      }
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
