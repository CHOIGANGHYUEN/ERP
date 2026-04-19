export class JobAssigner {
  static assignProfession(creature, world) {
    if (!creature.village) {
      // 마을이 없는 크리쳐는 채집가나 벌목꾼으로 기본 배정
      creature.profession = Math.random() > 0.5 ? 'GATHERER' : 'LUMBERJACK'
      return
    }

    const hasLeader = creature.village.creatures.some(
      (c) => c.profession === 'LEADER' && c !== creature,
    )

    if (!hasLeader && creature.age >= 4 && creature.profession !== 'LEADER') {
      creature.profession = 'LEADER'
      return
    }

    // [버그③ 수정] 촌장이 있으면 즉시 직업 배정 (기존: 촌장이 10% 확률로만 배정하여 공백 발생)
    JobAssigner.forceAssignJob(world, creature)
  }

  static forceAssignJob(world, creature) {
    if (!creature.village) return
    const inv = creature.village.inventory
    const food = (inv.food || 0) + (inv.biomass || 0)
    const wood = inv.wood || 0
    const population = creature.village.creatures.length

    const needsBuilder = creature.village.buildings.some((b) => !b.isConstructed)
    const builders = creature.village.creatures.filter((c) => c.profession === 'BUILDER').length
    const lumberjacks = creature.village.creatures.filter(
      (c) => c.profession === 'LUMBERJACK',
    ).length

    // 식량이 부족하면 무조건 식량 확보 직업 우선 (가장 높은 우선순위)
    if (food < population * 2) {
      if (world.currentFertility > 500) creature.profession = 'FARMER'
      else creature.profession = 'GATHERER'
    } else if (needsBuilder && builders < Math.max(2, population / 4)) {
      creature.profession = 'BUILDER'
    } else if (wood < population * 2 && lumberjacks < Math.max(2, population / 3)) {
      creature.profession = 'LUMBERJACK'
    } else if (wood >= 30 && creature.village.buildings.length < population && builders < 2) {
      creature.profession = 'BUILDER'
    } else if ((inv.stone || 0) < 30 && world.mines.length > 0 && Math.random() < 0.3) {
      creature.profession = 'MINER'
    } else if (
      creature.village.buildings.some((b) => b.type === 'SCHOOL' && b.isConstructed) &&
      Math.random() < 0.2
    ) {
      creature.profession = 'SCHOLAR'
    } else if (
      population >= 5 &&
      creature.village.creatures.filter((c) => c.profession === 'WARRIOR').length <
        Math.floor(population / 5)
    ) {
      creature.profession = 'WARRIOR'
    } else if (
      population >= 10 &&
      creature.village.buildings.some((b) => b.type === 'MARKET' && b.isConstructed) &&
      creature.village.creatures.filter((c) => c.profession === 'MERCHANT').length <
        Math.max(1, Math.floor(population / 10))
    ) {
      creature.profession = 'MERCHANT'
    } else {
      if (creature.profession === 'NONE') {
        creature.profession = Math.random() > 0.6 ? 'LUMBERJACK' : 'FARMER'
      }
    }
  }
}
