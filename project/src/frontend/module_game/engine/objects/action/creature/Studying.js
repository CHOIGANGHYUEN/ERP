export const STUDYING = (creature, deltaTime, world) => {
  if (!creature.target) {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }
  if (creature.distanceTo(creature.target) < creature.size + (creature.target.size || 0)) {
    if (creature.village) {
      creature.village.inventory.knowledge =
        (creature.village.inventory.knowledge || 0) + deltaTime * 0.01
    }
  } else {
    creature.moveToTarget(creature.target.x, creature.target.y, deltaTime, world)
  }
}
