import { Rectangle } from '../../../systems/QuadTree.js'

export const WARRIOR = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)
  const searchRadius = creature.village.radius + 100
  const range = new Rectangle(
    creature.village.x - searchRadius,
    creature.village.y - searchRadius,
    searchRadius * 2,
    searchRadius * 2,
  )
  const threats = world.quadTree.query(range)
  let closestThreat = null,
    minThreatDist = Infinity

  for (const t of threats) {
    if (t.isDead || t.type !== 'CARNIVORE') continue
    const dist = creature.distanceTo(t)
    if (dist < searchRadius && dist < minThreatDist) {
      closestThreat = t
      minThreatDist = dist
    }
  }

  if (closestThreat) {
    creature.target = closestThreat
    creature.state = 'ATTACKING'
  } else {
    creature.wander(world, creature.village.radius)
  }
}
