export const AnimalBehaviors = {
  FLEE: (animal, target, _world) => {
    animal.state = 'WANDERING'
    animal.targetX = animal.x + (animal.x - target.x)
    animal.targetY = animal.y + (animal.y - target.y)
    animal.target = null
  },
  EAT: (animal, target, _world) => {
    animal.state = 'EATING'
    animal.target = target
  },
  HUNT: (animal, target, _world) => {
    animal.state = 'HUNTING'
    animal.target = target
  },
}
