export class AnimalEmotion {
  static init(animal) {
    animal.needs = { hunger: 0, thirst: 0 }
    animal.emotions = { fear: 0, aggression: animal.type === 'CARNIVORE' ? 50 : 0 }
  }

  static update(animal, deltaTime) {
    animal.needs.hunger = Math.min(100, animal.needs.hunger + (deltaTime / 1000) * 2.0)
    if (animal.needs.hunger >= 100) {
      animal.energy -= deltaTime * 0.05
    }
  }

  static evaluateSurvivalNeeds(animal, candidates) {
    if (animal.type === 'HERBIVORE') {
      const predators = candidates.filter(
        (c) => c.type === 'CARNIVORE' && !c.isDead && animal.distanceTo(c) < 200,
      )
      if (predators.length > 0) {
        animal.emotions.fear = 100
        return { action: 'FLEE', target: predators[0] }
      } else animal.emotions.fear = Math.max(0, animal.emotions.fear - 5)

      if (animal.needs.hunger > 50) {
        const grasses = candidates.filter((c) => c.type === 'grass' && !c.isDead)
        if (grasses.length > 0)
          return { action: 'EAT', target: grasses[Math.floor(Math.random() * grasses.length)] }
      }
    } else if (animal.type === 'CARNIVORE') {
      if (animal.needs.hunger > 60) {
        animal.emotions.aggression = 100
        const preys = candidates.filter((c) => c.type === 'HERBIVORE' && !c.isDead)
        if (preys.length > 0)
          return { action: 'HUNT', target: preys[Math.floor(Math.random() * preys.length)] }
      } else animal.emotions.aggression = Math.max(0, animal.emotions.aggression - 5)
    }
    return null
  }

  static fulfillHunger(animal) {
    animal.needs.hunger = 0
  }
}
