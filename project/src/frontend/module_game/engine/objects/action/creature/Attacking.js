export const ATTACKING = (creature, deltaTime, world) => {
  if (!creature.target || creature.target.isDead) {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }
  if (creature.distanceTo(creature.target) < creature.size + (creature.target.size || 0) + 5) {
    // [수정] 기본 데미지에 attackPower 곱하기
    creature.target.energy -= deltaTime * 0.1 * (creature.attackPower || 1)
    if (creature.target.energy <= 0) {
      creature.target.die(world)
      creature.state = 'WANDERING'
      creature.target = null
    }
  } else {
    creature.moveToTarget(creature.target.x, creature.target.y, deltaTime, world)
  }
}
