export const VillageActions = {
  update: (village, deltaTime, world) => {
    try {
      // 💡 [버그 수정] 생성 직후 tickTimer가 undefined여서 NaN이 되어 영원히 업데이트가 멈추는 버그 방어
      village.tickTimer = (village.tickTimer || 0) + deltaTime
      // 💡 [버그 수정] 마을 인벤토리가 없을 경우 초기화
      if (!village.inventory) village.inventory = { wood: 0, food: 0, stone: 0, gold: 0, iron: 0 }

      if (village.tickTimer >= 1000) {
        village.tickTimer = 0

        VillageActions.handleExpansion(village, world)
        VillageActions.handleEconomy(village, world)
        VillageActions.handleConstructionAI(village, world)
      }
    } catch (e) {
      console.error(`[Village Action Error] ID ${village?.id}:`, e)
    }
  },

  // 1. 영토 확장 로직 (Grid Territory System - BFS Expansion)
  handleExpansion: (village, world) => {
    if (!world.territory) return

    const vId = world.villages.indexOf(village) + 1
    if (vId === 0) return

    if (village._territoryTiles === undefined) {
      village._territoryTiles = 0
      const cx = Math.floor(village.x / 16)
      const cy = Math.floor(village.y / 16)
      // 타일 탐색의 전초기지(Fringe 큐)
      village._fringe = [{ x: cx, y: cy }]
    }

    // 인구 및 건물 수에 따른 목표 점령 타일 수
    const targetArea = Math.min(20 + village.creatures.length * 8 + village.buildings.length * 20, 2500)

    // 💡 [프리징 차단] 한 프레임당 최대 5칸씩만 야금야금 점령 (연쇄반응 부하 방지)
    let ops = 5
    while (village._fringe.length > 0 && ops > 0 && village._territoryTiles < targetArea) {
      // 💡 [유기적 점령] 무작위 방향으로 팝하여 아메바(Slime Mold) 처럼 자연스럽게 자라게 함
      const rIdx = Math.floor(Math.random() * village._fringe.length)
      const tile = village._fringe.splice(rIdx, 1)[0]
      const tx = tile.x
      const ty = tile.y

      if (tx < 0 || tx >= 200 || ty < 0 || ty >= 200) continue
      const tidx = ty * 200 + tx

      // 이미 다른 마을 땅이거나, 지형이 바다/심해 등 건널 수 없는 곳이면 스킵
      if (world.territory[tidx] !== 0 && world.territory[tidx] !== vId) continue
      if (world.terrain && world.terrain[tidx] >= 2) continue

      // 내 땅이 아니었다면 점령!
      if (world.territory[tidx] !== vId) {
        world.territory[tidx] = vId
        village._territoryTiles++
        ops--

        // 영토 변화 시 배경 렌더링 갱신 트리거
        world.needsBackgroundUpdate = true

        // 상하좌우 빈 칸을 다시 영토 확장 후보에 넣음
        if (ty > 0) village._fringe.push({ x: tx, y: ty - 1 })
        if (ty < 199) village._fringe.push({ x: tx, y: ty + 1 })
        if (tx > 0) village._fringe.push({ x: tx - 1, y: ty })
        if (tx < 199) village._fringe.push({ x: tx + 1, y: ty })
      }
    }

    // 이전 코드를 위한 하위 호환성 반경 (기하학적 면적을 통한 추정 반경)
    village.radius = Math.max(100, Math.sqrt(village._territoryTiles) * 16 / Math.PI * 2)
  },

  // 2. 경제 및 자원 수집 로직 (Grid 기반 세금/자원 징수)
  handleEconomy: (village, world) => {
    const inv = village.inventory
    const vId = world.villages.indexOf(village) + 1

    // 패시브 자원 생산
    village.creatures.forEach((c) => {
      if (c.isDead || !c.isAdult) return
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

    // 💡 [Grid Validation] 영토 위로 떨어진 모든 필드 자원 자동 수집 (반경 거리계산 제거)
    // 최적화를 위해 바운딩 박스를 먼저 계산하여 쿼리
    const searchRadius = village.radius * 1.5
    const range = {
      x: village.x - searchRadius, y: village.y - searchRadius,
      width: searchRadius * 2, height: searchRadius * 2,
    }
    const nearbyItems = world.chunkManager.query(range)

    if (world.territory) {
      nearbyItems.forEach((item) => {
        if ((item._type === 'resource' || item.type === 'resource') && !item.isDead) {
          const tx = Math.floor(item.x / 16)
          const ty = Math.floor(item.y / 16)

          // 해당 자원이 우리 영토 내에 있는지(ownerId) 검사!
          if (tx >= 0 && tx < 200 && ty >= 0 && ty < 200) {
            if (world.territory[ty * 200 + tx] === vId) {
              const type = item.resourceType || item.type
              village.inventory[type] = (village.inventory[type] || 0) + 1

              if (['meat', 'milk', 'biomass'].includes(type)) {
                village.inventory.food = (village.inventory.food || 0) + 1
              }
              if (item.die) item.die(world)
            }
          }
        }
      })
    }
  },

  // 3. 건설 AI (Phased Planning: CAMPFIRE -> MARKET -> HOUSE)
  handleConstructionAI: (village, world) => {
    const taskBoard = world.taskBoardService
    const vId = world.villages.indexOf(village)
    const buildings = village.buildings

    // 3.1) 기존 마을 건물들 중 미완성인 건물들을 작업 게시판에 등록
    buildings.forEach(b => {
      if (!b.isConstructed && !b.isDead) {
        taskBoard?.publishTask(vId, {
          id: `build-${b.id}`,
          type: 'BUILD',
          targetId: b.id,
          targetType: 'building',
          priority: 10,
          position: { x: b.x, y: b.y }
        })
      }
    })

    // 3.2) 부지 선정 및 신규 건설 계획 (Phased Progression)
    const currentTime = Date.now()
    if (village.lastConstructionCheck && currentTime - village.lastConstructionCheck < 8000) return
    village.lastConstructionCheck = currentTime

    const hasIncomplete = buildings.some(b => !b.isConstructed)
    if (hasIncomplete) return // 이미 짓고 있는 건물이 있으면 추가 부지 선정 보류

    const hasCampfire = buildings.some(b => b.type === 'TOWN_HALL' || b.type === 'BARRACKS') // CAMPFIRE 대용
    const hasMarket = buildings.some(b => b.type === 'MARKET') // WAREHOUSE 대용

    // 유효한 부지 선정 함수
    const findPlot = (isTownHall = false) => {
      // 💡 [건설 개선] 첫 건물(TOWN_HALL)은 부지 탐색 없이 즉시 마을 중심에 건설
      if (isTownHall) {
        return { x: village.x, y: village.y }
      }
      // 다른 건물들은 위치를 여러 번 탐색
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = 30 + Math.random() * 80
        const tx = village.x + Math.cos(angle) * dist
        const ty = village.y + Math.sin(angle) * dist
        const gx = Math.floor(tx / 16), gy = Math.floor(ty / 16)
        if (gx >= 0 && gx < 200 && gy >= 0 && gy < 200) {
          const terrOwner = world.territory[gy * 200 + gx]
          // 💡 [건설 개선] 초기에는 영토가 좁으므로 남의 땅이 아닌 주인이 없는 땅(0)에도 확장을 허용
          if ((terrOwner === (vId + 1) || terrOwner === 0) && world.terrain[gy * 200 + gx] < 2) {
            return { x: tx, y: ty }
          }
        }
      }
      return null
    }

    // [Step 1] 캠프파이어 (TOWN_HALL 역할) 우선 구축
    if (!hasCampfire) {
      const plot = findPlot(true)
      if (plot) world.spawnBuilding(plot.x, plot.y, 'TOWN_HALL', village)
      return
    }

    // [Step 2] 저장고 (MARKET 역할) 구축
    if (!hasMarket) {
      if (village.inventory.wood >= 10) {
        const plot = findPlot()
        if (plot) {
          world.spawnBuilding(plot.x, plot.y, 'MARKET', village)
          village.inventory.wood -= 10
        }
      }
      return
    }

    // [Step 3] 거주지 (HOUSE) 건설 - 자원 여유가 있을 때만 진행
    const housingCapacity = buildings
      .filter((b) => b.type === 'HOUSE' && b.isConstructed)
      .reduce((sum, b) => sum + (b.capacity || 4), 0)

    if (village.creatures.length > housingCapacity) {
      // 거주지는 자원이 더 넉넉할 때 (나무 30, 식량 10 이상) 건설 시작
      if (village.inventory.wood >= 30 && village.inventory.food >= 10) {
        const plot = findPlot()
        if (plot) {
          world.spawnBuilding(plot.x, plot.y, 'HOUSE', village)
          village.inventory.wood -= 30
          village.inventory.food -= 10
        }
      }
    }
  },
}
