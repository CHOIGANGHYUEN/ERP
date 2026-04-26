import { MAX_ANIMALS } from '../../core/SharedState.js'

// 💡 생물 종별 고유 특성(Traits) 사전
export const ANIMAL_TRAITS = {
  WOLF: { isPack: true, courage: 80 },
  LION: { isPack: true, courage: 90 },
  TIGER: { isPack: false, courage: 95 }, // 고독한 사냥꾼
  BEAR: { isPack: false, courage: 85 },
  FOX: { isPack: false, courage: 50 },
  ELEPHANT: { isPack: true, courage: 100 }, // 무리지어 포식자에 맞섬
  MAMMOTH: { isPack: true, courage: 100 },
  BOAR: { isPack: true, courage: 70 }, // 맷돼지는 꽤 용감함
  COW: { isPack: true, courage: 40 },
  SHEEP: { isPack: true, courage: 20 },
  DEER: { isPack: true, courage: 30 },
  RABBIT: { isPack: false, courage: 10 }, // 매우 겁이 많음 (즉시 도주)
}

export class AnimalEmotion {
  static init(animal) {
    animal.needs = { hunger: 0, thirst: 0, fatigue: 0 }
    animal.emotions = { fear: 0, aggression: animal.type === 'CARNIVORE' ? 50 : 0, happy: 0 }
  }

  static update(animal, deltaTime) {
    animal.needs.hunger = Math.min(100, animal.needs.hunger + (deltaTime / 1000) * 1.5)
    animal.needs.fatigue = Math.min(100, animal.needs.fatigue + (deltaTime / 1000) * 1.0)

    if (animal.needs.hunger >= 100 || animal.needs.fatigue >= 100) {
      animal.emotions.happy = Math.max(0, animal.emotions.happy - 10)
      animal.energy -= deltaTime * 0.05
    } else {
      animal.emotions.happy = Math.min(100, animal.emotions.happy + (deltaTime / 1000) * 0.5)
    }
  }

  static evaluateSurvivalNeeds(animal, candidates, world) {
    const traits = ANIMAL_TRAITS[animal.species] || { isPack: false, courage: 50 }

    // 1순위: 포식자 회피 (초식)
    if (animal.type === 'HERBIVORE') {
      const predators = candidates.filter(
        (c) => c.type === 'CARNIVORE' && !c.isDead && animal.distanceTo(c) < 250,
      )
      if (predators.length > 0) {
        // 💡 [초식동물 역공] 매머드, 코끼리 등 거대 동물은 소수의 포식자를 만나면 도망치지 않고 맞서 싸움
        if (traits.courage >= 90 && predators.length <= 2) {
          animal.emotions.aggression = 100
          return { action: 'HUNT', target: predators[0] } // 초식동물의 분노의 돌진
        }

        // 💡 [군중 심리] 무리 동물은 주변에 동족이 많으면 공포심이 반감됨
        let fearMultiplier = 1.0
        if (traits.isPack) {
          const friends = candidates.filter(c => c.species === animal.species && !c.isDead && animal.distanceTo(c) < 150)
          if (friends.length > predators.length * 2) fearMultiplier = 0.5
        }

        if (traits.courage < 50 || Math.random() < fearMultiplier) {
          animal.emotions.fear = 100
          return { action: 'FLEE', target: predators[0] }
        }
      } else animal.emotions.fear = Math.max(0, animal.emotions.fear - 5)
    }

    // 1.5순위: 팩 헌팅 (늑대, 사자 등의 사회적 무리 사냥)
    if (animal.type === 'CARNIVORE' && traits.isPack) {
      // 동족이 이미 누군가를 사냥 중이라면 즉시 합세하여 포위망을 구축함
      const huntingFriend = candidates.find(c =>
        c.species === animal.species && !c.isDead && c.state === 'HUNTING' && c.target && !c.target.isDead
      )
      if (huntingFriend && huntingFriend.target) {
        animal.emotions.aggression = 100
        return { action: 'HUNT', target: huntingFriend.target }
      }
    }

    // 2순위: 악천후(비) 및 야간 대피 (은신)
    if (world && world.weather && world.timeSystem) {
      const isRaining = world.weather.weatherType === 'rain'
      const isNight = world.timeSystem.timeOfDay > 19000 || world.timeSystem.timeOfDay < 5000

      // 도망쳐야 할 포식자가 없고, 극심한 허기가 없을 때 주변 은신처를 찾음
      if ((isRaining || isNight) && animal.needs.hunger < 80) {
        // 건물, 나무, 혹은 광맥(동굴 대용)을 피난처로 탐색
        const shelters = candidates.filter(c =>
          !c.isDead &&
          ((c._type === 'plant' && c.type === 'tree') ||
            (c._type === 'mine') ||
            (c._type === 'building' && c.isConstructed)) &&
          animal.distanceTo(c) < 600
        )

        if (shelters.length > 0) {
          shelters.sort((a, b) => animal.distanceTo(a) - animal.distanceTo(b))
          return { action: 'HIDE', target: shelters[0] }
        }
      }
    }

    // 3순위: 수면욕 (피로도가 80 이상일 때 수면)
    if (animal.needs.fatigue > 80) {
      return { action: 'REST', target: null }
    }

    // 4순위: 식욕 및 사냥
    if (animal.type === 'HERBIVORE' && animal.needs.hunger > 50) {
      const grasses = candidates.filter((c) => c.type === 'grass' && !c.isDead && animal.distanceTo(c) < 300)
      if (grasses.length > 0)
        return { action: 'EAT', target: grasses[Math.floor(Math.random() * grasses.length)] }
    } else if (animal.type === 'CARNIVORE') {
      if (animal.needs.hunger > 60) {
        const preys = candidates.filter((c) => c.type === 'HERBIVORE' && !c.isDead && animal.distanceTo(c) < 350)
        if (preys.length > 0) {
          // 💡 [지능적 타겟 선정] 단독 사냥꾼은 대형(코끼리 등) 먹이를 피하고, 무리 사냥꾼은 상관없이 공격
          preys.sort((a, b) => {
            let scoreA = animal.distanceTo(a); let scoreB = animal.distanceTo(b)
            const traitA = ANIMAL_TRAITS[a.species] || { courage: 50 }
            const traitB = ANIMAL_TRAITS[b.species] || { courage: 50 }
            if (!traits.isPack && traitA.courage >= 90) scoreA += 10000 // 호랑이가 매머드 건드리는 것 억제
            if (!traits.isPack && traitB.courage >= 90) scoreB += 10000
            return scoreA - scoreB
          })

          if (!(!traits.isPack && ANIMAL_TRAITS[preys[0].species]?.courage >= 90)) {
            animal.emotions.aggression = 100
            return { action: 'HUNT', target: preys[0] }
          }
        }
      } else animal.emotions.aggression = Math.max(0, animal.emotions.aggression - 5)
    }

    // 💡 덩치가 작은 동물은 성숙이 빠르고 번식 조건도 완화됨 (크기 * 2 가 성숙 나이 기준)
    const maturityAge = (animal.baseSize || 10) * 2

    // 4.5순위: 아기 동물의 부모 따라다니기 (졸졸이)
    if (animal.age < maturityAge && animal.parent && !animal.parent.isDead) {
      return { action: 'FOLLOW', target: animal.parent }
    }

    // 5순위: 번식욕 (행복도가 높고 배고프지 않으며, 번식 쿨타임이 없을 때)
    if (animal.emotions.happy > 50 && animal.age > maturityAge && animal.needs.hunger < 40 && (animal.matingCooldown || 0) <= 0) {
      const mates = candidates.filter(c =>
        c !== animal &&
        c.species === animal.species &&
        !c.isDead &&
        c.age > maturityAge &&
        (c.matingCooldown || 0) <= 0 &&
        c.emotions && c.emotions.happy > 50
      )
      if (mates.length > 0) {
        return { action: 'MATE', target: mates[0] }
      }
    }

    return null
  }

  static fulfillHunger(animal, amount = 100) {
    // 💡 [크기 비례 식사량] 덩치가 클수록 포만감이 적게 차서 더 많은 양의 먹이를 먹어야 함
    const sizeFactor = 10 / (animal.baseSize || 10)
    animal.needs.hunger = Math.max(0, animal.needs.hunger - amount * sizeFactor)
  }
}
