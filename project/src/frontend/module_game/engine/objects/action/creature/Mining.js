export const MINING = (creature, deltaTime, world) => {
  if (!creature.target || creature.target.isDead) {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }
  if (creature.distanceTo(creature.target) < creature.size + (creature.target.size || 0)) {
    creature.target.energy -= deltaTime * 0.2
    if (Math.random() < 0.05) {
      creature.inventory[creature.target.type] = (creature.inventory[creature.target.type] || 0) + 1
      if (creature.village) creature.state = 'RETURNING'
    }
  } else {
    creature.moveToTarget(creature.target.x, creature.target.y, deltaTime, world)
  }
}
