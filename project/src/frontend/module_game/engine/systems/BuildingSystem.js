export class BuildingSystem {
  update(deltaTime, world) {
    for (let i = world.buildings.length - 1; i >= 0; i--) {
      const b = world.buildings[i]
      const wasConstructed = b.isConstructed
      
      // 건물 업데이트 (뇌 위임 - 생산, 업그레이드 등)
      b.update(deltaTime, world)

      if (wasConstructed !== b.isConstructed) {
        world.needsBackgroundUpdate = true
      }

      // 💡 [방치된 건물 자동 파괴 및 환불]
      // unreachable 마킹이 된 지 2분(120초)이 경과하면 건물을 포기하고 파괴합니다.
      if (!b.isConstructed && b.isUnreachable && b._unreachableAt) {
        if (Date.now() - b._unreachableAt > 120000) {
          this.demolishAbondonedBuilding(b, i, world)
          continue // 삭제되었으므로 다음 루프 진행
        }
      }

      // 목장(RANCH) 특수 로직은 독립된 시스템이나 인젝터로 나중에 완전 이관 가능하지만,
      // 일단은 데이터 일치를 위해 이곳에서 유지하거나 b.brain에 위임할 수 있습니다.
      // (지금은 일반 건물 규격에 맞춰 b.brain.update 내부로 흡수하는 것이 장기적으로 좋습니다)
      this.handleSpecialBuildingLogic(b, deltaTime, world)
    }
  }

  demolishAbondonedBuilding(b, index, world) {
    // 1. 환불 로직
    if (b.village) {
      const inv = b.village.inventory
      if (b.type === 'HOUSE') inv.wood = (inv.wood || 0) + 30
      if (b.type === 'FARM') inv.wood = (inv.wood || 0) + 40
      if (b.type === 'MARKET') { inv.wood = (inv.wood || 0) + 100; inv.stone = (inv.stone || 0) + 30 }
      if (b.type === 'BARRACKS') { inv.wood = (inv.wood || 0) + 50; inv.stone = (inv.stone || 0) + 20 }
      if (b.type === 'SMITHY') { inv.wood = (inv.wood || 0) + 40; inv.stone = (inv.stone || 0) + 30 }
      if (b.type === 'SCHOOL') inv.wood = (inv.wood || 0) + 60
      if (b.type === 'TEMPLE') { inv.wood = (inv.wood || 0) + 100; inv.stone = (inv.stone || 0) + 50; inv.gold = (inv.gold || 0) + 10 }
      
      world.broadcastEvent(`[${b.village.name}] 도달 불가능한 건설지(${b.type})를 철거하고 자원을 회수했습니다.`, '#95a5a6')
    }

    // 2. 월드에서 안전하게 제거
    world.buildings.splice(index, 1)
    world.needsFullChunkRefresh = true // ChunkManager 동기화 유도
    if (b.village && b.village.buildings) {
      const vIdx = b.village.buildings.indexOf(b)
      if (vIdx !== -1) b.village.buildings.splice(vIdx, 1)
    }
    
    // 파티클 생성 (철거 효과)
    world.spawnParticle(b.x, b.y, { color: '#bdc3c7', count: 10, speed: 20 })
  }

  handleSpecialBuildingLogic(b, deltaTime, world) {
    // Phase 3: 목장(RANCH) 특수 처리 (데이터 전용)
    if (b.isConstructed && b.type === 'RANCH') {
      b.ranchTimer = (b.ranchTimer || 0) + deltaTime
      if (b.ranchTimer > 5000) {
        b.ranchTimer = 0
        this.runRanchCycle(b, world)
      }
    }
  }

  runRanchCycle(b, world) {
    const nearbyCows = world.animals.filter(
      (a) =>
        !a.isDead &&
        a.species === 'COW' &&
        Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) < 150,
    )

    if (nearbyCows.length < 3 && Math.random() < 0.4) {
      world.spawnAnimal(
        b.x + (Math.random() - 0.5) * 50,
        b.y + (Math.random() - 0.5) * 50,
        'COW',
      )
    }

    nearbyCows.forEach((cow) => {
      if (Math.random() < 0.5)
        world.spawnResource(
          cow.x + (Math.random() - 0.5) * 20,
          cow.y + (Math.random() - 0.5) * 20,
          'milk',
        )
      cow.ranchAge = (cow.ranchAge || 0) + 5000
      if (cow.ranchAge > 40000) {
        cow.die(world)
        for (let i = 0; i < 3; i++)
          world.spawnResource(
            cow.x + (Math.random() - 0.5) * 20,
            cow.y + (Math.random() - 0.5) * 20,
            'meat',
          )
        world.spawnParticle(cow.x, cow.y, { color: '#c0392b', count: 15, speed: 40 })
      }
    })
  }
}
