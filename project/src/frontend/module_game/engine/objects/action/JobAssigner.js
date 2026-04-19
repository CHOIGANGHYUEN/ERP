export class JobAssigner {
  static assignProfession(creature, world) {
    console.log(`🔍 [JobAssigner] assignProfession 시작 (Creature ID: ${creature.id})`);
    if (!creature.village) {
      creature.profession = Math.random() > 0.5 ? 'GATHERER' : 'LUMBERJACK'
      return
    }

    const hasLeader = (creature.village.professionCounts['LEADER'] || 0) > 0

    if (!hasLeader && creature.age >= 4 && creature.profession !== 'LEADER') {
      const oldJob = creature.profession
      creature.profession = 'LEADER'
      creature.village.updateProfessionCount(oldJob, 'LEADER')
      return
    }

    JobAssigner.forceAssignJob(world, creature)
    console.log(`✅ [JobAssigner] assignProfession 완료 (Creature ID: ${creature.id})`);
  }

  static forceAssignJob(world, creature) {
    if (!creature.village) return
    const v = creature.village
    const inv = v.inventory
    const food = (inv.food || 0) + (inv.biomass || 0)
    const wood = inv.wood || 0
    const population = v.creatures.length

    const needsBuilder = (v.buildingCounts.unconstructed || 0) > 0
    const builders = v.professionCounts['BUILDER'] || 0
    const lumberjacks = v.professionCounts['LUMBERJACK'] || 0

    const oldJob = creature.profession
    let newJob = oldJob

    // 식량이 부족하면 무조건 식량 확보 직업 우선
    if (food < population * 2) {
      if (world.currentFertility > 500) newJob = 'FARMER'
      else newJob = 'GATHERER'
    } else if (needsBuilder && builders < Math.max(2, population / 4)) {
      newJob = 'BUILDER'
    } else if (wood < population * 2 && lumberjacks < Math.max(2, population / 3)) {
      newJob = 'LUMBERJACK'
    } else if (wood >= 30 && v.buildingCounts.total < population && builders < 2) {
      newJob = 'BUILDER'
    } else if ((inv.stone || 0) < 30 && world.mines && world.mines.length > 0 && Math.random() < 0.3) {
      newJob = 'MINER'
    } else if (
      (v.buildingCounts.school || 0) > 0 && 
      Math.random() < 0.2
    ) {
      // TODO: buildingCounts에 세부 타입별 카운트 도입 시 school로 체크
      newJob = 'SCHOLAR'
    } else if (
      population >= 5 &&
      (v.professionCounts['WARRIOR'] || 0) < Math.floor(population / 5)
    ) {
      newJob = 'WARRIOR'
    } else if (
      population >= 10 &&
      (v.professionCounts['MERCHANT'] || 0) < Math.max(1, Math.floor(population / 10))
    ) {
      newJob = 'MERCHANT'
    } else {
      if (oldJob === 'NONE') {
        newJob = Math.random() > 0.6 ? 'LUMBERJACK' : 'FARMER'
      }
    }

    if (newJob !== oldJob) {
      creature.profession = newJob
      v.updateProfessionCount(oldJob, newJob)
    }
  }
}
