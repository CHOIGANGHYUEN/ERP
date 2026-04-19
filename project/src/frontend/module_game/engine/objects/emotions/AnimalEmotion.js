import { MAX_ANIMALS } from '../../core/SharedState.js'

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

  static evaluateSurvivalNeeds(animal, candidates) {
    // 1순위: 포식자 회피 (초식)
    if (animal.type === 'HERBIVORE') {
      const predators = candidates.filter(
        (c) => c.type === 'CARNIVORE' && !c.isDead && animal.distanceTo(c) < 200,
      )
      if (predators.length > 0) {
        animal.emotions.fear = 100
        return { action: 'FLEE', target: predators[0] }
      } else animal.emotions.fear = Math.max(0, animal.emotions.fear - 5)
    }

    // 2순위: 수면욕 (피로도가 80 이상일 때 구석으로 도망쳐서 잔다)
    if (animal.needs.fatigue > 80) {
       return { action: 'REST', target: null }
    }

    // 3순위: 식욕
    if (animal.type === 'HERBIVORE' && animal.needs.hunger > 50) {
      const grasses = candidates.filter((c) => c.type === 'grass' && !c.isDead && animal.distanceTo(c) < 300)
      if (grasses.length > 0)
        return { action: 'EAT', target: grasses[Math.floor(Math.random() * grasses.length)] }
    } else if (animal.type === 'CARNIVORE') {
      if (animal.needs.hunger > 60) {
        animal.emotions.aggression = 100
        const preys = candidates.filter((c) => c.type === 'HERBIVORE' && !c.isDead && animal.distanceTo(c) < 300)
        if (preys.length > 0)
          return { action: 'HUNT', target: preys[Math.floor(Math.random() * preys.length)] }
      } else animal.emotions.aggression = Math.max(0, animal.emotions.aggression - 5)
    }

    // 4순위: 번식욕 (행복도가 높고 자원이 풍부할 때)
    if (animal.emotions.happy > 80 && animal.age > 50 && animal.needs.hunger < 20) {
      // 월드 엔티티 배열이 필요하므로 candidates에서 종이 같은 성체를 찾음
      const mates = candidates.filter(c => c !== animal && c.species === animal.species && !c.isDead && c.age > 50 && c.emotions && c.emotions.happy > 50)
      if (mates.length > 0) {
        return { action: 'MATE', target: mates[0] }
      }
    }

    return null
  }

  static fulfillHunger(animal) {
    animal.needs.hunger = 0
  }
}
