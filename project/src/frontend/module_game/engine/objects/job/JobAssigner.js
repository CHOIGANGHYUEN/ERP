export class JobAssigner {
  static assignProfession(creature, world) {
    if (!creature.village) {
      creature.profession = Math.random() > 0.5 ? 'GATHERER' : 'LUMBERJACK'
      return
    }

    const hasLeader = creature.village.creatures.some(
      (c) => c.profession === 'LEADER' && c !== creature,
    )

    if (!hasLeader && creature.age >= 10 && creature.profession !== 'LEADER') {
      creature.profession = 'LEADER'
      return
    }

    if (hasLeader && creature.profession !== 'NONE') {
      return
    }

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

    if (
      food < population * 2 &&
      !creature.village.buildings.some((b) => b.type === 'FARM' && b.isConstructed)
    ) {
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
    } else {
      creature.profession = Math.random() > 0.6 ? 'LUMBERJACK' : 'FARMER'
    }
  }
}
