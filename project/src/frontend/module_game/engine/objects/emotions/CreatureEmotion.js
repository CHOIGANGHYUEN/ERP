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
    creature.needs.hunger = Math.min(100, creature.needs.hunger + (deltaTime / 1000) * 1.5)
    creature.needs.fatigue = Math.min(100, creature.needs.fatigue + (deltaTime / 1000) * 1.0)
    creature.emotions.happiness = Math.max(
      0,
      100 - (creature.needs.hunger + creature.needs.fatigue) / 2,
    )
    // 성인일 때만 짝짓기 욕구 증가
    if (creature.isAdult) {
      creature.needs.matingUrge = Math.min(100, creature.needs.matingUrge + deltaTime * 0.005)
    }

    if (creature.needs.hunger >= 100) {
      creature.die(world)
      return true // 아사 처리됨
    }
    return false
  }

  // 순수하게 감정/욕구만 평가하여 DRIVE(충동/의도) 상태를 반환
  static evaluateSurvivalNeeds(creature, world) {
    // 1. 위협 감지 및 공포 상승
    const searchRange = { x: creature.x - 200, y: creature.y - 200, width: 400, height: 400 }
    const candidates = world.chunkManager.query(searchRange)
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

    // 2. 짝짓기 욕구 (생존이 안정적일 때만)
    if (creature.isAdult && creature.needs.matingUrge > 90 && creature.matingCooldown <= 0) {
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

    // 3. 피로도가 높거나 밤 시간이 되면 집을 찾아 휴식 (Night Routine)
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

    // 4. 배고픔이 심하면 식량 탐색
    if (creature.needs.hunger > 70) {
      const food = candidates.find(
        (c) => c.type === 'food' || (c.type === 'crop' && c.size >= c.maxSize * 0.8),
      )

      if (food) {
        return { type: DRIVE.EAT, payload: { food } }
      } else if (creature.village && creature.village.inventory.food > 0) {
        return { type: DRIVE.EAT, payload: { village: creature.village } }
      }
    }

    // 5. 무작위 사회적 상호작용 (대화)
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
