export class BuildingSystem {
  update(deltaTime, world) {
    world.buildings.forEach((b) => {
      const wasConstructed = b.isConstructed
      
      // 건물 업데이트 (뇌 위임 - 생산, 업그레이드 등)
      b.update(deltaTime, world)

      if (wasConstructed !== b.isConstructed) {
        world.needsBackgroundUpdate = true
      }

      // 목장(RANCH) 특수 로직은 독립된 시스템이나 인젝터로 나중에 완전 이관 가능하지만,
      // 일단은 데이터 일치를 위해 이곳에서 유지하거나 b.brain에 위임할 수 있습니다.
      // (지금은 일반 건물 규격에 맞춰 b.brain.update 내부로 흡수하는 것이 장기적으로 좋습니다)
      this.handleSpecialBuildingLogic(b, deltaTime, world)
    })
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
