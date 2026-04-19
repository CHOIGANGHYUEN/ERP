import { PROPS, SEASON_MAP, STRIDE, WEATHER_MAP } from '../SharedState.js'

export const WorldUpdater = {
  update: (world, deltaTime) => {
    if (world.isHeadless) {
      // Worker: 실제 게임 로직 연산
      // [Optimization] Tick 밸런싱: 모든 시스템을 매 프레임 업데이트하지 않고 분산 처리
      world.tick = (world.tick || 0) + 1
      
      // 매 프레임 필수 업데이트
      world.timeSystem.update(deltaTime)
      world.entitySystem.update(deltaTime, world)

      // (A) 동적 객체만 매 프레임 갱신 (GC 최소화)
      world.chunkManager.clear()
      for (let i = 0; i < world.creatures.length; i++) world.chunkManager.insert(world.creatures[i], false)
      for (let i = 0; i < world.animals.length; i++) world.chunkManager.insert(world.animals[i], false)
      for (let i = 0; i < world.disasterSystem.tornadoes.length; i++) world.chunkManager.insert(world.disasterSystem.tornadoes[i], false)

      // (B) 정적 객체는 필요할 때만 갱신 (1초마다 혹은 개체수 변동 시)
      world.staticRefreshTimer = (world.staticRefreshTimer || 0) + deltaTime
      if (world.staticRefreshTimer > 1000 || world.needsFullChunkRefresh) {
        world.chunkManager.clearAll() // 전체 초기화 후 다시 삽입
        for (let i = 0; i < world.buildings.length; i++) world.chunkManager.insert(world.buildings[i], true)
        for (let i = 0; i < world.plants.length; i++) world.chunkManager.insert(world.plants[i], true)
        for (let i = 0; i < world.resources.length; i++) world.chunkManager.insert(world.resources[i], true)
        for (let i = 0; i < world.mines.length; i++) world.chunkManager.insert(world.mines[i], true)
        for (let i = 0; i < world.villages.length; i++) world.chunkManager.insert(world.villages[i], true)
        world.staticRefreshTimer = 0
        world.needsFullChunkRefresh = false
      }

      // 10틱마다 업데이트 (약 160ms)
      if (world.tick % 10 === 0) {
        world.weather.update(deltaTime * 10)
      }

      // 20틱마다 업데이트 (약 320ms)
      if (world.tick % 20 === 0) {
        world.villageSystem.update(deltaTime * 20, world)
        world.buildingSystem.update(deltaTime * 20, world)
      }

      // 60틱마다 업데이트 (약 1초) - 외교 등 무거운 연산
      if (world.tick % 60 === 0) {
        if (world.diplomacySystem) world.diplomacySystem.update(deltaTime * 60, world)
        world.disasterSystem.update(deltaTime * 60, world)
      }

      // 길찾기 감쇄는 자체적으로 분산 처리가 되어 있으므로 매 프레임 호출 (내부에서 쪼개짐)
      world.pathSystem.update(deltaTime, world)

      world.bgUpdateTimer += deltaTime
      if (world.bgUpdateTimer >= 2000) {
        world.needsBackgroundUpdate = true
        world.bgUpdateTimer = 0
      }
    } else if (world.views) {
      // Main Thread: 렌더링 사전 작업 (QuadTree 재구성 등)
      const globals = world.views.globals
      world.currentFertility = globals[PROPS.GLOBALS.FERTILITY]
      world.timeSystem.timeOfDay = globals[PROPS.GLOBALS.TIME_OF_DAY]
      world.timeSystem.season = Object.keys(SEASON_MAP)[globals[PROPS.GLOBALS.SEASON]] || 'SPRING'
      world.weather.weatherType =
        Object.keys(WEATHER_MAP)[globals[PROPS.GLOBALS.WEATHER_TYPE]] || 'clear'
      world.weather.windSpeed = globals[PROPS.GLOBALS.WIND_SPEED]
      world.disasterSystem.earthquakeTimer = globals[PROPS.GLOBALS.EARTHQUAKE_TIMER]

      world.chunkManager.clear()

      const entityCounts = {
        creature: globals[PROPS.GLOBALS.CREATURE_COUNT],
        animal: globals[PROPS.GLOBALS.ANIMAL_COUNT],
        plant: globals[PROPS.GLOBALS.PLANT_COUNT],
        building: globals[PROPS.GLOBALS.BUILDING_COUNT],
        tornado: globals[PROPS.GLOBALS.TORNADO_COUNT],
        mine: globals[PROPS.GLOBALS.MINE_COUNT],
        resource: globals[PROPS.GLOBALS.RESOURCE_COUNT],
        village: globals[PROPS.GLOBALS.VILLAGE_COUNT], // 마을 추가
      }

      // 복수형 변환 맵 (엔진 내 View 이름과 매칭)
      const pluralMap = {
        creature: 'creatures',
        animal: 'animals',
        plant: 'plants',
        building: 'buildings',
        tornado: 'tornadoes', // tornado -> tornadoes 버그 수정
        mine: 'mines',
        resource: 'resources',
        village: 'villages',
      }

      // (C) 메인 스레드 청크 매니저 업데이트 (렌더링 컬링용)
      world.chunkManager.clear()
      
      // [Optimization] 매 프레임 수천 개의 임시 객체 생성을 막기 위해 SpatialProxy 풀 사용 (INP 해결 핵심)
      if (!world.spatialProxies) world.spatialProxies = []
      let proxyIdx = 0

      const frontIndex = globals[PROPS.GLOBALS.RENDER_BUFFER_INDEX]
      const currentSet = world.views.sets[frontIndex]

      // [Optimization/BugFix] 방어적 렌더링: 버퍼 교체 시점에 데이터가 비어있으면 렌더링 건너뜀 (깜빡임 방지)
      const totalCount = 
        entityCounts.creature + entityCounts.animal + entityCounts.plant + 
        entityCounts.building + entityCounts.resource
      
      if (totalCount === 0 && (world._lastTotalCount || 0) > 0) {
        // 데이터가 아직 준비되지 않은 것으로 간주하고 이전 프레임의 청크매니저 유지
        return
      }
      world._lastTotalCount = totalCount

      for (const type in entityCounts) {
        const count = entityCounts[type]
        const viewName = pluralMap[type] || `${type}s`
        const view = currentSet[viewName]
        const props = PROPS[type.toUpperCase()]
        const stride = STRIDE[type.toUpperCase()]

        if (!props || !stride) continue

        const propX = props.X
        const propY = props.Y
        const propSize = props.SIZE
        const isStatic = ['building', 'plant', 'mine', 'resource', 'village'].includes(type)
        
        for (let i = 0; i < count; i++) {
          const offset = i * stride
          if (view[offset] === 1) { // IS_ACTIVE
            // 객체 생성 대신 풀에서 꺼내 재사용
            if (!world.spatialProxies[proxyIdx]) {
              world.spatialProxies[proxyIdx] = { _type: '', id: 0, x: 0, y: 0, size: 0 }
            }
            const proxy = world.spatialProxies[proxyIdx++]
            proxy._type = type
            proxy.id = i
            proxy.x = view[offset + propX]
            proxy.y = view[offset + propY]
            proxy.size = view[offset + propSize]

            world.chunkManager.insert(proxy, isStatic)
          }
        }
      }
      
      world.pathSystem.initSharedState(world)

      world.bgUpdateTimer += deltaTime
      if (world.bgUpdateTimer >= 2000) {
        world.needsBackgroundUpdate = true
        world.bgUpdateTimer = 0
      }

      world.particleSystem.update(deltaTime)
      world.interactionSystem.update(deltaTime, world) // world 추가 전달
    }
  }
}
