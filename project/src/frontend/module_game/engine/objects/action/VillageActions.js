export const VillageActions = {
  update: (village, deltaTime, world) => {
    try {
      village.tickTimer += deltaTime
      if (village.tickTimer >= 1000) {
        village.tickTimer = 0

        VillageActions.handleExpansion(village)
        VillageActions.handleEconomy(village, world)
        VillageActions.handleConstructionAI(village, world)
      }
    } catch (e) {
      console.error(`[Village Action Error] ID ${village?.id}:`, e)
    }
  },

  // 1. 영토 확장 로직
  handleExpansion: (village) => {
    const targetRadius = 200 + village.creatures.length * 15 + village.buildings.length * 25
    const oldRadius = village.radius
    village.radius += (targetRadius - village.radius) * 0.1

    // 반지름 변화량이 클 때만 로그 출력
    if (Math.abs(oldRadius - village.radius) > 1) {
      // console.log(`[Expansion] ${village.name} 세력권 확장 중: ${Math.floor(village.radius)}`);
    }
  },

  // 2. 경제 및 자원 수집 로직
  handleEconomy: (village, world) => {
    const inv = village.inventory

    // 패시브 자원 생산
    village.creatures.forEach((c) => {
      if (c.isDead || !c.isAdult) return

      if (c.profession === 'FARMER' || c.profession === 'GATHERER') {
        if (Math.random() < 0.2) {
          inv.food = (inv.food || 0) + 1
          // console.log(`[Economy] ${c.id}(${c.profession}): 식량 생산 (+1)`);
        }
      } else if (c.profession === 'LUMBERJACK') {
        if (Math.random() < 0.2) {
          inv.wood = (inv.wood || 0) + 1
          // console.log(`[Economy] ${c.id}(LUMBERJACK): 나무 생산 (+1)`);
        }
      } else if (c.profession === 'MINER') {
        if (Math.random() < 0.1) inv.stone = (inv.stone || 0) + 1
        if (Math.random() < 0.05) inv.iron = (inv.iron || 0) + 1
      } else if (c.profession === 'SCHOLAR') {
        if (Math.random() < 0.1) inv.knowledge = (inv.knowledge || 0) + 1
      } else if (c.profession === 'MERCHANT') {
        if (Math.random() < 0.15) inv.gold = (inv.gold || 0) + 1
        if (Math.random() < 0.1) inv.food = (inv.food || 0) + 1
      }
    })

    // 주변 자원 자동 수집
    const range = {
      x: village.x - village.radius,
      y: village.y - village.radius,
      width: village.radius * 2,
      height: village.radius * 2,
    }
    const nearbyItems = world.chunkManager.query(range)

    nearbyItems.forEach((item) => {
      if ((item._type === 'resource' || item.type === 'resource') && !item.isDead) {
        const dist = Math.sqrt(Math.pow(item.x - village.x, 2) + Math.pow(item.y - village.y, 2))
        if (dist < village.radius) {
          const type = item.resourceType || item.type
          village.inventory[type] = (village.inventory[type] || 0) + 1

          if (['meat', 'milk', 'biomass'].includes(type)) {
            village.inventory.food = (village.inventory.food || 0) + 1
          }
          if (item.die) item.die(world)
        }
      }
    })
  },

  // 3. 건설 AI (최적화 및 버그 수정 버전)
  handleConstructionAI: (village, world) => {
    const currentTime = Date.now()

    // [핵심 수정] 판단 쿨다운: 3초(3000ms)에 한 번만 건설 여부를 판단함
    // village 객체에 lastConstructionCheck 속성이 기록됩니다.
    if (village.lastConstructionCheck && currentTime - village.lastConstructionCheck < 3000) {
      return
    }
    village.lastConstructionCheck = currentTime

    console.groupCollapsed(`🛠️ [Village: ${village.name}] 건설 AI 변수 추적 디버깅`)

    try {
      console.log(`[Step 1] 마을 인구 및 인벤토리 로드 시작`)
      const population = village.creatures.length
      const inv = village.inventory
      console.log(`[Step 1] 통과 완료`)

      console.log(`[Step 2] 주거 수용량(housingCapacity) 계산 시작`)
      const housingCapacity = village.buildings
        .filter((b) => b.type === 'HOUSE' && b.isConstructed)
        .reduce((sum, b) => sum + (b.capacity || 2), 0)
      console.log(`[Step 2] 통과 완료 (수용량: ${housingCapacity})`)

      console.log(`[Step 3] 현재 건설 중인 집(isBuildingHouse) 여부 확인 시작`)
      const isBuildingHouse = village.buildings.some((b) => b.type === 'HOUSE' && !b.isConstructed)
      console.log(`[Step 3] 통과 완료 (진행 중인 집: ${isBuildingHouse})`)

      console.log(
        `[상태 요약] 인구: ${population}/${housingCapacity} | 목재: ${inv.wood || 0} | 석재: ${inv.stone || 0}`,
      )

      console.log(`[Step 4] 🏠 집(HOUSE) 건설 조건 판단 진입`)
      // --- [HOUSE] 건설 로직 ---
      if (population > housingCapacity && !isBuildingHouse) {
        console.log(`[판단] 🏠 집 건설 필요 (인구 ${population} > 수용량 ${housingCapacity})`)
        // 나무 자원 확인 (부족하면 여기서 중단)
        if ((inv.wood || 0) < 30) {
          console.log(`[거절] ❌ 목재 부족 (필요: 30, 보유: ${inv.wood || 0})`)
          return // 💡 이제 여기서 return을 해도 finally 블록에서 안전하게 groupEnd()가 호출됩니다.
        }

        console.log(`[Step 4-1] 놀고 있는 건축가(BUILDER) 탐색 시작`)
        // 놀고 있는 빌더 찾기
        const builder = village.creatures.find(
          (c) => c.profession === 'BUILDER' && (c.state === 'WANDERING' || c.state === 'IDLE'),
        )
        console.log(`[Step 4-1] 탐색 완료`)

        if (builder) {
          console.log(`[실행] ✅ 대기 중인 건축가(BUILDER) 발견 (ID: ${builder.id})`)
          const angle = Math.random() * Math.PI * 2
          const radius = 50 + Math.random() * (village.radius || 100) * 0.5
          const spawnX = village.x + Math.cos(angle) * radius
          const spawnY = village.y + Math.sin(angle) * radius

          console.log(
            `[실행] 📍 집 건설 스폰 좌표 설정: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`,
          )

          console.log(`[Step 4-2] world.spawnBuilding(HOUSE) 호출 직전! (여기서 멈추는지 확인)`)
          // 건물 스폰 및 자원 차감
          world.spawnBuilding(spawnX, spawnY, 'HOUSE', village)
          inv.wood -= 30
          console.log(`[Step 4-2] world.spawnBuilding 호출 무사히 통과!`)
          console.log(`[결과] 📉 자원 차감 완료: 목재 -30 (남은 목재: ${inv.wood})`)

          world.broadcastEvent(`[${village.name}]에 집이 부족하여 새 집을 짓습니다!`, '#e67e22')
        } else {
          console.log(`[보류] ❌ 현재 놀고 있는 건축가(BUILDER)가 없어 명령을 대기합니다.`)
        }
      } else {
        console.log(`[판단] 🏠 집 건설 불필요 (인구 여유가 있거나 이미 건설 중)`)
      }
      console.log(`[Step 4] 🏠 집(HOUSE) 로직 완전 종료`)

      console.log(`[Step 5] 🏪 시장(MARKET) 건설 조건 판단 진입`)
      // --- [MARKET] 건설 로직 ---
      const hasMarket = village.buildings.some((b) => b.type === 'MARKET')
      const isBuildingMarket = village.buildings.some(
        (b) => b.type === 'MARKET' && !b.isConstructed,
      )

      console.log(
        `[변수] hasMarket(시장 보유): ${hasMarket} / isBuildingMarket(시장 건설 중): ${isBuildingMarket}`,
      )

      if (population >= 10 && !hasMarket && !isBuildingMarket) {
        console.log(`[판단] 🏪 시장 건설 필요 (인구 10명 이상)`)
        // 시장 건설 자원 확인
        if ((inv.wood || 0) >= 100 && (inv.stone || 0) >= 30) {
          console.log(`[Step 5-1] 놀고 있는 건축가 탐색 시작`)
          const builder = village.creatures.find(
            (c) => c.profession === 'BUILDER' && (c.state === 'WANDERING' || c.state === 'IDLE'),
          )
          console.log(`[Step 5-1] 탐색 완료`)

          if (builder) {
            const angle = Math.random() * Math.PI * 2
            const radius = 40 + Math.random() * 80
            const spawnX = village.x + Math.cos(angle) * radius
            const spawnY = village.y + Math.sin(angle) * radius

            console.log(
              `[실행] 📍 시장 건설 좌표 설정: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`,
            )

            console.log(`[Step 5-2] world.spawnBuilding(MARKET) 호출 직전! (여기서 멈추는지 확인)`)
            world.spawnBuilding(spawnX, spawnY, 'MARKET', village)
            inv.wood -= 100
            inv.stone -= 30
            console.log(`[Step 5-2] world.spawnBuilding 호출 무사히 통과!`)
            console.log(
              `[결과] 📉 자원 차감 완료: 목재 -100 (남음: ${inv.wood}), 석재 -30 (남음: ${inv.stone})`,
            )

            world.broadcastEvent(`[${village.name}]에 시장(Market)이 건설됩니다! 🏪`, '#f39c12')
          } else {
            console.log(`[보류] ❌ 현재 놀고 있는 건축가가 없습니다.`)
          }
        } else {
          console.log(`[거절] ❌ 시장 건설 자원 부족 (목재 100 / 석재 30 필요)`)
        }
      } else {
        console.log(`[판단] 🏪 시장 건설 불필요 (인구 부족이거나 이미 보유 중)`)
      }
      console.log(`[Step 5] 🏪 시장(MARKET) 로직 완전 종료`)
    } finally {
      console.groupEnd()
    }
  },
}
