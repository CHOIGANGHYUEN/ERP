export const DRIVE = {
  PANIC: 'PANIC',
  MATING: 'MATING',
  SLEEP: 'SLEEP',
  EAT: 'EAT',
  SOCIAL: 'SOCIAL',
  NONE: 'NONE',
}

export class CreatureEmotion {
  static init(creature) {
    creature.needs = { hunger: 0, fatigue: 0 }
    creature.emotions = { happiness: 100, fear: 0 }
    creature.needs.matingUrge = 0
  }

  static update(creature, deltaTime, world) {
    // 생물 노화 속도 변경에 따른 에코 시스템 동기화 (Atomic Modification)
    // 맵 이동시간이 늘어났으므로 허기와 피로도 누적치를 1/10로 대폭 줄여서 업무 수행 시간을 충분히 보장합니다.
    creature.needs.hunger = Math.min(100, creature.needs.hunger + (deltaTime / 1000) * 0.15)
    creature.needs.fatigue = Math.min(100, creature.needs.fatigue + (deltaTime / 1000) * 0.10)
    creature.emotions.happiness = Math.max(
      0,
      100 - (creature.needs.hunger + creature.needs.fatigue) / 2,
    )
    // 성인일 때만 짝짓기 욕구 증가
    if (creature.isAdult) {
      creature.needs.matingUrge = Math.min(100, creature.needs.matingUrge + deltaTime * 0.005)
    }

    if (creature.needs.hunger >= 100) {
      // 아사 원인에 현재 행동 상태 포함
      const stateLabel = {
        WANDERING:  '배회 중',
        GATHERING:  '자원 채집 중',
        HARVESTING: '수확 중',
        MINING:     '채광 중',
        BUILDING:   '건설 중',
        STUDYING:   '공부 중',
        RETURNING:  '귀환 중',
        ATTACKING:  '전투 중',
        TRAINING:   '훈련 중',
        RESTING:    '휴식 중',
        MATING:     '짝짓기 중',
        FLEEING:    '도망 중',
        TRADING:    '교역 중',
        DEPOSITING: '창고 납부 중',
        SUFFERING:  '고통 상태',
        IDLE:       '대기 중',
      }[creature.state] || creature.state

      // 진행 중인 태스크가 있으면 추가 정보 포함
      const task = creature.taskQueue?.[0]
      const taskInfo = task ? ` (작업: ${task.type})` : ''

      creature.die(world, `굶주림으로 아사 — ${stateLabel}${taskInfo}, 허기 ${Math.round(creature.needs.hunger)}%`)
      return true
    }
    return false
  }

  // 순수하게 감정/욕구만 평가하여 DRIVE(충동/의도) 상태를 반환
  static evaluateSurvivalNeeds(creature, world) {
    // 1. 위협 감지 및 공포 상승
    // 💡 [공포 영향 제거] 작업 중(taskQueue 보유)인 경우 위협을 감지하지 않고 작업에만 집중합니다.
    const isBusy = creature.taskQueue && creature.taskQueue.length > 0
    const searchRange = { x: creature.x - 200, y: creature.y - 200, width: 400, height: 400 }
    const candidates = world.chunkManager.query(searchRange)

    if (!isBusy) {
      const threat = candidates.find(
        (c) =>
          (c.type === 'CARNIVORE' && !c.isDead) ||
          (creature.profession !== 'WARRIOR' &&
            c.profession === 'WARRIOR' &&
            c.village?.nation &&
            creature.village?.nation &&
            creature.village.nation.getRelation(c.village.nation).status === 'WAR'),
      )
      if (threat) {
        creature.emotions.fear = 100
        return { type: DRIVE.PANIC, payload: { threat } }
      } else {
        creature.emotions.fear = Math.max(0, creature.emotions.fear - 0.1)
      }
    } else {
      // 작업 중이면 공포 수치가 자연스럽게 빠르게 감소하도록 하여 평온 유지
      creature.emotions.fear = Math.max(0, creature.emotions.fear - 0.5)
    }

    // 2. 짝짓기 욕구 (생존이 안정적이고 마을에 빈 집이 있을 때만)
    const canBreed = creature.village && creature.village.hasHousingCapacity()
    if (creature.isAdult && canBreed && creature.needs.matingUrge > 90 && creature.matingCooldown <= 0) {
      const partner = candidates.find(
        (c) =>
          c.id !== creature.id &&
          c.profession !== undefined && // is a creature
          c.isAdult &&
          c.state === 'WANDERING' &&
          c.matingCooldown <= 0 &&
          c.village === creature.village,
      )

      if (partner) {
        return { type: DRIVE.MATING, payload: { partner } }
      }
    }

    // 4. 배고픔이 심하면 식량 탐색 (SLEEP보다 우선 — 굶으면서 자는 버그 수정)
    if (creature.needs.hunger > 60) {
      // 4-1. 주변에 먹을 것이 있으면 바로 먹으러 감
      if (candidates) {
        const food = candidates.find(
          (c) => c.type === 'food' || (c.type === 'crop' && c.size >= c.maxSize * 0.8),
        )
        if (food) {
          return { type: DRIVE.EAT, payload: { food } }
        }
      }
      // 4-2. 마을 창고에 식량이 있으면 귀환하여 섭취
      if (creature.village && creature.village.inventory.food > 0) {
        return { type: DRIVE.EAT, payload: { village: creature.village } }
      }
    }

    // 5. 피로도가 높거나 밤 시간이 되면 집을 찾아 휴식 (Night Routine)
    const isNight =
      world.timeSystem && (world.timeSystem.timeOfDay < 5000 || world.timeSystem.timeOfDay > 19000)
    if ((creature.needs.fatigue > 80 || isNight) && creature.village) {
      if (creature.home && creature.home.isConstructed) {
        return { type: DRIVE.SLEEP, payload: { house: creature.home } }
      }

      const houses = creature.village.buildings.filter(
        (b) => b.type === 'HOUSE' && b.isConstructed && b.occupants.length < b.capacity,
      )
      if (houses.length > 0) {
        // 가장 가까운 집 찾기
        let closestHouse = null
        let minDistance = Infinity
        for (const house of houses) {
          const dist = creature.distanceTo(house)
          if (dist < minDistance) {
            minDistance = dist
            closestHouse = house
          }
        }
        if (closestHouse) {
          return { type: DRIVE.SLEEP, payload: { house: closestHouse } }
        }
      }
      return { type: DRIVE.SLEEP, payload: { village: creature.village } }
    }

    // (EAT 드라이브가 위로 이동되었으므로 이 블록은 hunger <= 60 상황에서만 도달)
    if (creature.needs.hunger > 85) {
      // 극도의 기아 상태: 주변 어떤 음식이든 찾음
      const anyCandidates = world.chunkManager.query({ x: creature.x - 400, y: creature.y - 400, width: 800, height: 800 })
      const food = anyCandidates.find(
        (c) => c.type === 'food' || c.type === 'biomass' || (c.type === 'crop' && c.size >= c.maxSize * 0.5),
      )
      if (food) return { type: DRIVE.EAT, payload: { food } }
      if (creature.village && creature.village.inventory.food > 0) {
        return { type: DRIVE.EAT, payload: { village: creature.village } }
      }
    }

    // 7. 무작위 사회적 상호작용 (대화)
    if (Math.random() < 0.05) {
      const neighbor = candidates.find(
        (c) =>
          c !== creature && c.profession !== undefined && !c.isDead && creature.distanceTo(c) < 40,
      )
      if (neighbor) {
        return { type: DRIVE.SOCIAL, payload: { neighbor } }
      }
    }

    return { type: DRIVE.NONE }
  }

  static fulfillHunger(creature) {
    creature.needs.hunger = 0
    creature.emotions.happiness = Math.min(100, creature.emotions.happiness + 30)
  }
  static fulfillFatigue(creature, amount = null) {
    if (amount) creature.needs.fatigue = Math.max(0, creature.needs.fatigue - amount)
    else creature.needs.fatigue = 0
  }
}
