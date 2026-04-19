export const VillageActions = {
  update: (village, deltaTime, world) => {
    village.tickTimer += deltaTime
    if (village.tickTimer >= 1000) {
      village.tickTimer = 0

      // console.log(`[Village:${village.name}] --- 1초 틱 업데이트 시작 ---`);
      VillageActions.handleExpansion(village)
      VillageActions.handleEconomy(village, world)
      VillageActions.handleConstructionAI(village, world)
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

          console.log(`[Economy] 영토 내 자원 발견 및 수집: ${type} (거리: ${Math.floor(dist)})`)

          if (['meat', 'milk', 'biomass'].includes(type)) {
            village.inventory.food = (village.inventory.food || 0) + 1
          }
          if (item.die) item.die(world)
        }
      }
    })
  },

  // 3. 건설 AI
  handleConstructionAI: (village, world) => {
    const population = village.creatures.length
    const inv = village.inventory

    const housingCapacity = village.buildings
      .filter((b) => b.type === 'HOUSE' && b.isConstructed)
      .reduce((sum, b) => sum + (b.capacity || 2), 0)

    const isBuildingHouse = village.buildings.some((b) => b.type === 'HOUSE' && !b.isConstructed)

    // [HOUSE] 건설 트리거 디버깅
    if (population > housingCapacity && !isBuildingHouse) {
      console.log(`[Construction_AI] 집 부족 감지! (인구:${population}/수용량:${housingCapacity})`)

      if ((inv.wood || 0) >= 30) {
        const builder = village.creatures.find(
          (c) => c.profession === 'BUILDER' && (c.state === 'WANDERING' || c.state === 'IDLE'),
        )

        if (builder) {
          const angle = Math.random() * Math.PI * 2
          const radius = 50 + Math.random() * village.radius * 0.5
          const spawnX = village.x + Math.cos(angle) * radius
          const spawnY = village.y + Math.sin(angle) * radius

          world.spawnBuilding(spawnX, spawnY, 'HOUSE', village)
          inv.wood -= 30

          console.log(
            `[Construction_AI] 집 건설 시작! 빌더:${builder.id}, 위치:[${Math.floor(spawnX)}, ${Math.floor(spawnY)}]`,
          )
          world.broadcastEvent(`[${village.name}]에 집이 부족하여 새 집을 짓습니다!`, '#e67e22')
        } else {
          console.warn(`[Construction_AI] 집을 지어야 하지만 한가한 BUILDER가 없습니다.`)
        }
      } else {
        console.log(
          `[Construction_AI] 집을 지어야 하지만 나무가 부족합니다. (보유:${inv.wood}/필요:30)`,
        )
      }
    }

    // [MARKET] 건설 트리거 디버깅
    const hasMarket = village.buildings.some((b) => b.type === 'MARKET')
    const isBuildingMarket = village.buildings.some((b) => b.type === 'MARKET' && !b.isConstructed)

    if (population >= 10 && !hasMarket && !isBuildingMarket) {
      console.log(`[Construction_AI] 시장 건설 조건 충족 (인구 10명 이상)`)

      if ((inv.wood || 0) >= 100 && (inv.stone || 0) >= 30) {
        const builder = village.creatures.find((c) => c.profession === 'BUILDER')
        if (builder) {
          const angle = Math.random() * Math.PI * 2
          const radius = 40 + Math.random() * 80
          world.spawnBuilding(
            village.x + Math.cos(angle) * radius,
            village.y + Math.sin(angle) * radius,
            'MARKET',
            village,
          )
          inv.wood -= 100
          inv.stone -= 30

          console.log(`[Construction_AI] 시장 건설 시작! 위치 인근`)
          world.broadcastEvent(`[${village.name}]에 시장(Market)이 건설됩니다! 🏪`, '#f39c12')
        } else {
          console.warn(`[Construction_AI] 시장을 지을 빌더가 없습니다.`)
        }
      } else {
        console.log(`[Construction_AI] 시장 자원 부족 (W:${inv.wood}/100, S:${inv.stone}/30)`)
      }
    }
  },
}
