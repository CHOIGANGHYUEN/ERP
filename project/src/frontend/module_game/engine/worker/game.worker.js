import { World } from '../core/World.js'

let world = null

self.onmessage = (e) => {
  const { type, payload } = e.data

  if (type === 'INIT') {
    // DOM 연산 없는 헤드리스 모드로 월드 초기화
    world = new World(null, true)
    world.startLogic((state) => {
      // 매 루프마다 연산된 상태값을 메인 스레드로 전송
      self.postMessage({ type: 'SYNC', payload: state })
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
    }
  }
}
