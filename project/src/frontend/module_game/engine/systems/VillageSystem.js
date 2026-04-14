export class VillageSystem {
  update(deltaTime, world) {
    world.villages.forEach((v) => {
      v.update(deltaTime, world)

      // Phase 3: 마을 인프라 - 누적 자원에 따른 건물 티어(Tier) 진화
      if (v.inventory && v.inventory.wood >= 150 && v.inventory.stone >= 50) {
        const upgradable = v.buildings.find((b) => b.isConstructed && (b.tier || 1) < 3)
        if (upgradable) {
          upgradable.tier = (upgradable.tier || 1) + 1
          // 집(HOUSE) 티어 상승 시 최대 거주 가능 인원 수 증가
          if (upgradable.type === 'HOUSE') {
            upgradable.capacity = 1 + upgradable.tier
          }
          v.inventory.wood -= 150
          v.inventory.stone -= 50
          world.needsBackgroundUpdate = true
          world.broadcastEvent(
            `[${v.name}]의 건물이 티어 ${upgradable.tier}(으)로 진화했습니다!`,
            '#3498db',
          )
        }
      }

      // 마을의 주거 공간이 부족하면 자동으로 집을 짓도록 AI 트리거
      const population = v.creatures.length
      const housingCapacity = v.buildings
        .filter((b) => b.type === 'HOUSE' && b.isConstructed)
        .reduce((sum, b) => sum + (b.capacity || 2), 0)
      const isBuildingHouse = v.buildings.some((b) => b.type === 'HOUSE' && !b.isConstructed)

      if (population > housingCapacity && !isBuildingHouse && v.creatures.length > 0) {
        const builder = v.creatures.find(
          (c) => c.profession === 'BUILDER' && c.state === 'WANDERING',
        )
        if (builder) {
          const angle = Math.random() * Math.PI * 2
          const radius = 50 + Math.random() * v.radius * 0.5
          world.spawnBuilding(
            v.x + Math.cos(angle) * radius,
            v.y + Math.sin(angle) * radius,
            'HOUSE',
            v,
          )
          world.broadcastEvent(`[${v.name}]에 집이 부족하여 새 집을 짓습니다!`, '#e67e22')
        }
      }
    })
  }
}
