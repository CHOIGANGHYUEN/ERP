import { PROPS, SEASON_MAP, STRIDE, WEATHER_MAP } from '../SharedState.js'

export const WorldUpdater = {
  update: (world, deltaTime) => {
    try {
      if (world.isHeadless) {
        // Worker: 실제 게임 로직 연산
        // [Optimization] Tick 밸런싱: 모든 시스템을 매 프레임 업데이트하지 않고 분산 처리
        world.tick = (world.tick || 0) + 1

        // 매 프레임 필수 업데이트
        world.timeSystem.update(deltaTime)
        world.entitySystem.update(deltaTime, world)

        // (A) 💡 [최적화] 매 프레임 정적 객체(건물, 자원)를 다시 삽입하지 않고, 변화가 있거나 일정 주기(1초)마다만 갱신
        const needsStaticReset = world.needsFullChunkRefresh || (world.staticRefreshTimer || 0) > 1000
        if (needsStaticReset) {
          world.chunkManager.clearAll()
          world.staticRefreshTimer = 0
          world.needsFullChunkRefresh = false
        } else {
          world.chunkManager.clear() // 동적 객체만 매 프레임 비움
        }

        // 동적 객체 삽입 (매 프레임)
        for (let i = 0; i < world.creatures.length; i++)
          world.chunkManager.insert(world.creatures[i], false)
        for (let i = 0; i < world.animals.length; i++)
          world.chunkManager.insert(world.animals[i], false)
        for (let i = 0; i < world.disasterSystem.tornadoes.length; i++)
          world.chunkManager.insert(world.disasterSystem.tornadoes[i], false)

        // 정적 객체 삽입 (주기적 혹은 강제 갱신 시에만 수행)
        if (needsStaticReset) {
          for (let i = 0; i < world.buildings.length; i++)
            world.chunkManager.insert(world.buildings[i], true)
          for (let i = 0; i < world.plants.length; i++)
            world.chunkManager.insert(world.plants[i], true)
          for (let i = 0; i < world.resources.length; i++)
            world.chunkManager.insert(world.resources[i], true)
          for (let i = 0; i < world.mines.length; i++) world.chunkManager.insert(world.mines[i], true)
          for (let i = 0; i < world.villages.length; i++)
            world.chunkManager.insert(world.villages[i], true)
        }

        world.staticRefreshTimer = (world.staticRefreshTimer || 0) + deltaTime

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

        // [New AI Architecture Update Loop]
        if (world.perceptionSystem) world.perceptionSystem.update(deltaTime, world)
        if (world.workSystem) world.workSystem.update(deltaTime, world)
        if (world.assignmentSystem) world.assignmentSystem.update(deltaTime, world)
        if (world.behaviorSystem) world.behaviorSystem.update(deltaTime, world)
        if (world.movementSystem) world.movementSystem.update(deltaTime, world)

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

        const entityCounts = {
          creature: globals[PROPS.GLOBALS.CREATURE_COUNT],
          animal: globals[PROPS.GLOBALS.ANIMAL_COUNT],
          plant: globals[PROPS.GLOBALS.PLANT_COUNT],
          building: globals[PROPS.GLOBALS.BUILDING_COUNT],
          tornado: globals[PROPS.GLOBALS.TORNADO_COUNT],
          mine: globals[PROPS.GLOBALS.MINE_COUNT],
          resource: globals[PROPS.GLOBALS.RESOURCE_COUNT],
          village: globals[PROPS.GLOBALS.VILLAGE_COUNT],
        }

        // [Optimization/BugFix] 방어적 렌더링: 버퍼 교체 시점에 데이터가 비어있으면 렌더링 건너뜀 (깜빡임 방지)
        const totalCount =
          entityCounts.creature +
          entityCounts.animal +
          entityCounts.plant +
          entityCounts.building +
          entityCounts.resource +
          entityCounts.tornado

        if (totalCount === 0 && (world._lastTotalCount || 0) > 0) {
          // 데이터가 아직 준비되지 않은 경우, 기존 청크매니저를 유지하여 잔상/깜빡임 방지
          return
        }
        world._lastTotalCount = totalCount

        // (C) 메인 스레드 청크 매니저 업데이트 (렌더링 컬링용)
        const needsStaticReset = world.needsFullChunkRefresh || (world.staticRefreshTimer || 0) > 1000
        if (needsStaticReset) {
          world.chunkManager.clearAll()
          // 세계 공통 타이머는 워커에서 관리하므로 메인 스레드는 상태 전이를 따름
        } else {
          world.chunkManager.clear()
        }

        const pluralMap = {
          creature: 'creatures',
          animal: 'animals',
          plant: 'plants',
          building: 'buildings',
          tornado: 'tornadoes',
          mine: 'mines',
          resource: 'resources',
          village: 'villages',
        }

        if (!world.spatialProxies) world.spatialProxies = []
        let proxyIdx = 0

        // [Atomic Load] Atomics.load를 사용하여 워커의 쓰기가 완료된 최신 인덱스를 안전하게 가져옴
        const frontIndex = Atomics.load(world.views.globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)
        const currentSet = world.views.sets[frontIndex]

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

          // 💡 [최적화] 정적 리셋 주기가 아닐 경우, 이미 그리드에 박혀있는 정적 객체 삽입 루프는 건너뜀
          if (isStatic && !needsStaticReset) {
            // (주의) 렌더링용 프록시 배열(spatialProxies)은 매 프레임 모든 활성 객체를 포함해야 하므로,
            // 인덱스 계산을 위해 루프를 돌거나, 렌드링 시스템에 맞춰 쿼리 방식을 조율해야 함.
            // 여기서는 렌더링 성능을 위해 일단 모든 활성 객체를 spatialProxies에 넣고, 
            // chunkManager insert만 선별적으로 수행.
          }

          for (let i = 0; i < count; i++) {
            const offset = i * stride
            if (view[offset] === 1) {
              // IS_ACTIVE
              if (!world.spatialProxies[proxyIdx]) {
                world.spatialProxies[proxyIdx] = { _type: '', id: 0, x: 0, y: 0, size: 0 }
              }
              const proxy = world.spatialProxies[proxyIdx++]
              proxy._type = type
              proxy.id = i
              proxy.x = view[offset + propX]
              proxy.y = view[offset + propY]
              proxy.size = view[offset + propSize]

              if (!isStatic || needsStaticReset) {
                world.chunkManager.insert(proxy, isStatic)
              }

              // 💡 [건물 렌더링 수정] 조명 시스템(LightingSystem)에서 밤에 불을 밝힐 수 있도록 완공 여부 추가
              if (type === 'building') {
                proxy.isConstructed = view[offset + PROPS.BUILDING.IS_CONSTRUCTED] === 1
              }
            }
          }
        }

        // 💡 [프리징 원천 차단 4] 프록시 배열의 끝을 확실히 잘라주어 가비지(유령) 데이터가
        // 무한정 누적되어 Main Thread의 렌더링 및 상호작용 연산을 마비시키는 메모리 누수 방지
        world.spatialProxies.length = proxyIdx

        world.pathSystem.initSharedState(world)
        world.particleSystem.update(deltaTime)
        world.interactionSystem.update(deltaTime, world)

        world.staticRefreshTimer = (world.staticRefreshTimer || 0) + deltaTime
        if (world.staticRefreshTimer > 1000 || world.needsFullChunkRefresh) {
          world.staticRefreshTimer = 0
          world.needsFullChunkRefresh = false
        }

        world.bgUpdateTimer += deltaTime
        if (world.bgUpdateTimer >= 2000) {
          world.needsBackgroundUpdate = true
          world.bgUpdateTimer = 0
        }
      }
    } catch (fatalError) {
      console.error(
        '🚨 [WorldUpdater Fatal Error] 게임 루프 메인 스레드 보호막 작동 (프리징 방지):',
        fatalError,
      )
    }
  },
}
