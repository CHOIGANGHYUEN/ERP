export const VillageActions = {
  update: (village, deltaTime, world) => {
    village.tickTimer += deltaTime
    if (village.tickTimer >= 1000) {
      village.tickTimer = 0
      
      VillageActions.handleExpansion(village)
      VillageActions.handleEconomy(village, world)
      VillageActions.handleConstructionAI(village, world)
    }
  },

  // 1. 영토(세력권) 확장 로직
  handleExpansion: (village) => {
    const targetRadius = 200 + village.creatures.length * 15 + village.buildings.length * 25
    village.radius += (targetRadius - village.radius) * 0.1
  },

  // 2. 경제 및 자원 수집 로직
  handleEconomy: (village, world) => {
    // 패시브 자원 생산
    village.creatures.forEach((c) => {
      if (c.isDead || !c.isAdult) return
      const inv = village.inventory
      if (c.profession === 'FARMER' || c.profession === 'GATHERER') {
        if (Math.random() < 0.2) inv.food = (inv.food || 0) + 1
      } else if (c.profession === 'LUMBERJACK') {
        if (Math.random() < 0.2) inv.wood = (inv.wood || 0) + 1
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
      // item._type 체크 (SAB 버젼 대응)
      if ((item._type === 'resource' || item.type === 'resource') && !item.isDead) {
         const dist = Math.sqrt(Math.pow(item.x - village.x, 2) + Math.pow(item.y - village.y, 2))
         if (dist < village.radius) {
            const type = item.resourceType || item.type
            village.inventory[type] = (village.inventory[type] || 0) + 1
            if (['meat', 'milk', 'biomass'].includes(type)) {
              village.inventory.food = (village.inventory.food || 0) + 1
            }
            // Worker 내부에서 처리한다면 world를 통해 die 호출
            if (item.die) item.die(world)
         }
      }
    })
  },

  // 3. 건설 AI (인구 대비 주거지 및 인프라 자동 생성)
  handleConstructionAI: (village, world) => {
    const population = village.creatures.length
    const housingCapacity = village.buildings
      .filter((b) => b.type === 'HOUSE' && b.isConstructed)
      .reduce((sum, b) => sum + (b.capacity || 2), 0)
    
    const isBuildingHouse = village.buildings.some((b) => b.type === 'HOUSE' && !b.isConstructed)

    // 집 건설 트리거 (인구 대비 주거지 부족 + 건설 중인 집이 없음 + 최소 자원 보유)
    if (population > housingCapacity && !isBuildingHouse && village.creatures.length > 0 && (village.inventory.wood || 0) >= 30) {
      const builder = village.creatures.find(c => c.profession === 'BUILDER' && (c.state === 'WANDERING' || c.state === 'IDLE'))
      if (builder) {
        const angle = Math.random() * Math.PI * 2
        const radius = 50 + Math.random() * village.radius * 0.5
        world.spawnBuilding(village.x + Math.cos(angle) * radius, village.y + Math.sin(angle) * radius, 'HOUSE', village)
        village.inventory.wood -= 30 // 자원 즉시 차감 (워커 내에서 동기화)
        world.broadcastEvent(`[${village.name}]에 집이 부족하여 새 집을 짓습니다!`, '#e67e22')
      }
    }

    // 시장 건설 트리거
    const hasMarket = village.buildings.some((b) => b.type === 'MARKET')
    const isBuildingMarket = village.buildings.some((b) => b.type === 'MARKET' && !b.isConstructed)
    if (population >= 10 && !hasMarket && !isBuildingMarket && (village.inventory.wood || 0) >= 100 && (village.inventory.stone || 0) >= 30) {
       const builder = village.creatures.find(c => c.profession === 'BUILDER')
       if (builder) {
          const angle = Math.random() * Math.PI * 2
          const radius = 40 + Math.random() * 80
          world.spawnBuilding(village.x + Math.cos(angle) * radius, village.y + Math.sin(angle) * radius, 'MARKET', village)
          village.inventory.wood -= 100
          village.inventory.stone -= 30
          world.broadcastEvent(`[${village.name}]에 시장(Market)이 건설됩니다! 🏪`, '#f39c12')
       }
    }
  }
}
