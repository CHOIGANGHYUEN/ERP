import { AnimalEmotion } from '../../emotions/AnimalEmotion.js'

export const HUNTING = (animal, deltaTime, world) => {
  if (!animal.target || animal.target.isDead) {
    animal.state = 'WANDERING'
    animal.target = null
    return
  }

  if (animal.distanceTo(animal.target) < animal.size + (animal.target.size || 0) + 5) {
    if (animal.target.energy !== undefined) {
      animal.target.energy -= deltaTime * 0.1
      animal.energy = Math.min(100, animal.energy + deltaTime * 0.05)
      if (animal.target.energy <= 0) {
        const speciesName = animal.species || animal.type || '육식동물'
        animal.target.die(world, `${speciesName}에게 사냥당해 사망`)
        animal.state = 'WANDERING'
        animal.target = null
      }
      AnimalEmotion.fulfillHunger(animal)
    } else {
      const speciesName = animal.species || animal.type || '육식동물'
      animal.target.die(world, `${speciesName}에게 사냥당해 사망`)
      animal.energy = Math.min(100, animal.energy + 30)
      animal.state = 'WANDERING'
      animal.target = null
    }
  } else {
    animal.moveToTarget(animal.target.x, animal.target.y, deltaTime, world)
  }
}
