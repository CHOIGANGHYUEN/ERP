export const BUILDING = (creature, deltaTime, world) => {
  if (!creature.target || creature.target.isConstructed) {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }
  if (creature.distanceTo(creature.target) < creature.size + (creature.target.size || 0)) {
    creature.target.progress += deltaTime * 0.05
    if (creature.target.progress >= creature.target.maxProgress) {
      creature.target.isConstructed = true
      creature.state = 'WANDERING'
      creature.target = null
    }
  } else {
    creature.moveToTarget(creature.target.x, creature.target.y, deltaTime, world)
  }
}
