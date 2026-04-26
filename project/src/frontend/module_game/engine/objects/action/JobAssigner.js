export class JobAssigner {
  // 💡 [병목 개선] 한 프레임(약 16ms)에 동시 처리 가능한 최대 직업 배정 수 (Token Bucket)
  static assignCount = 0
  static lastResetTime = Date.now()

  // 💡 [중복/충돌 방지] 직업 변경 로직을 한 곳으로 통합하여 안전하게 처리
  static changeProfession(creature, newJob, isTemporary = false, force = false) {
    if (!creature || creature.profession === newJob) return

    const oldJob = creature.profession

    if (isTemporary) {
      if (!creature.originalProfession) creature.originalProfession = oldJob
    } else {
      creature.originalProfession = null
    }

    // 💡 [중요] 이미 진행 중인 작업이 있다면 업무의 연속성을 위해 직업 변경을 유보함 (초기화 방지)
    if (!force && creature.taskQueue && creature.taskQueue.length > 0) return

    creature.profession = newJob

    if (creature.village && typeof creature.village.updateProfessionCount === 'function') {
      creature.village.updateProfessionCount(oldJob, newJob)
    }

    // 💡 [실시간 연결] 직업 변경 시에도 하던 일(taskQueue)은 가급적 유지하고, 강제 변경 시에만 초기화
    if (force) {
      creature.taskQueue = []
      creature.state = 'WANDERING'
      creature.target = null
    }
  }

  static assignProfession(creature, world) {
    // 💡 [종신제 유지] 촌장은 자동으로 직업이 변경되지 않도록 보호
    if (creature.profession === 'LEADER') return

    try {
      const currentTime = Date.now()

      // 💡 [무한 요청 방지] 1초 이내 동일 크리쳐의 연속 요청 스킵
      if (creature._lastAssignTime && currentTime - creature._lastAssignTime < 1000) {
        return
      }
      creature._lastAssignTime = currentTime

      if (!creature.village) {
        const fallbackJob = Math.random() > 0.5 ? 'GATHERER' : 'LUMBERJACK'
        JobAssigner.changeProfession(creature, fallbackJob)
        return
      }

      // 💡 [중복 리더 방지] 장부(Counts)뿐만 아니라 실제 주민 리스트를 전수 조사하여 물리적 검증
      const hasLeader = (creature.village.professionCounts?.['LEADER'] || 0) > 0 ||
                        creature.village.creatures.some(c => c.profession === 'LEADER')

      // 리더 부재 시 조건부 리더 임명 (성인 우선)
      if (!hasLeader && creature.isAdult && creature.profession !== 'LEADER') {
        JobAssigner.changeProfession(creature, 'LEADER', false, true) // 강제 임명
        return
      }

      JobAssigner.forceAssignJob(world, creature)
    } catch (e) {
      console.error(`[JobAssigner Error] Creature ID ${creature?.id}:`, e)
    }
  }

  static forceAssignJob(world, creature) {
    // 💡 [종신제 유지] 촌장은 강제 재배정 대상에서 제외
    if (creature.profession === 'LEADER') return

    try {
      const currentTime = Date.now()

      // 💡 [무한 요청 방지] 1초 쿨타임 적용
      if (creature._lastForceTime && currentTime - creature._lastForceTime < 1000) return
      creature._lastForceTime = currentTime

      // 💡 [알고리즘: 쓰로틀링(Throttling)]
      if (currentTime - this.lastResetTime > 16) {
        this.assignCount = 0
        this.lastResetTime = currentTime
      }

      // 한 프레임에 10명 이상 할당 요청이 오면 스킵
      if (this.assignCount >= 10) {
        return
      }
      this.assignCount++

      if (!creature.village) return
      const v = creature.village
      const inv = v.inventory || {}
      const food = (inv.food || 0) + (inv.biomass || 0)
      const wood = inv.wood || 0
      const population = v.creatures?.length || 0

      const needsBuilder = (v.buildingCounts?.unconstructed || 0) > 0
      const builders = v.professionCounts?.['BUILDER'] || 0
      const lumberjacks = v.professionCounts?.['LUMBERJACK'] || 0

      const oldJob = creature.profession
      let newJob = oldJob
      let reason = '현행 유지'

      // --- 직업 결정 로직 시작 ---
      if (food < population * 2) {
        // 식량 부족 우선순위 1
        if (world.currentFertility > 500) {
          newJob = 'FARMER'
          reason = `식량 부족 (${food}/${population * 2}) & 토양 비옥함`
        } else {
          newJob = 'GATHERER'
          reason = `식량 부족 (${food}/${population * 2}) & 채집 우선`
        }
      } else if (needsBuilder && builders < Math.max(2, population / 4)) {
        newJob = 'BUILDER'
        reason = `미완공 건물 존재 (빌더 수: ${builders})`
      } else if (wood < population * 2 && lumberjacks < Math.max(2, population / 3)) {
        newJob = 'LUMBERJACK'
        reason = `목재 부족 (${wood}/${population * 2})`
      } else if (wood >= 30 && (v.buildingCounts?.total || 0) < population && builders < 2) {
        newJob = 'BUILDER'
        reason = `확장 필요 (목재 여유: ${wood})`
      } else if (
        (inv.stone || 0) < 30 &&
        world.mines &&
        world.mines.length > 0 &&
        Math.random() < 0.3
      ) {
        newJob = 'MINER'
        reason = `석재 부족 및 광산 근접`
      } else if ((v.buildingCounts?.school || 0) > 0 && Math.random() < 0.2) {
        newJob = 'SCHOLAR'
        reason = `교육 기관 활성화`
      } else if (
        population >= 5 &&
        (v.professionCounts['WARRIOR'] || 0) < Math.floor(population / 5)
      ) {
        newJob = 'WARRIOR'
        reason = `치안 유지 (인구: ${population})`
      } else if (
        population >= 10 &&
        (v.professionCounts['MERCHANT'] || 0) < Math.max(1, Math.floor(population / 10))
      ) {
        newJob = 'MERCHANT'
        reason = `상업 활동 개시`
      } else {
        if (oldJob === 'NONE') {
          newJob = Math.random() > 0.6 ? 'LUMBERJACK' : 'FARMER'
          reason = `초기 무직 상태 탈출`
        }
      }

      if (newJob !== oldJob) {
        JobAssigner.changeProfession(creature, newJob)
      }
    } catch (e) {
      console.error(`[JobAssigner forceAssignJob Error] Creature ID ${creature?.id}:`, e)
    }
  }
}
