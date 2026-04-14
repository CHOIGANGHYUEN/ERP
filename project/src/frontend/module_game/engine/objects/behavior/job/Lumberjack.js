export const LUMBERJACK = (creature, world, candidates) => {
  let closestWood = null,
    minWoodDist = Infinity
  let closestTree = null,
    minTreeDist = Infinity

  for (const c of candidates) {
    if (c.isDead) continue
    const dist = creature.distanceTo(c)
    if (c.type === 'wood') {
      if (dist < minWoodDist) {
        closestWood = c
        minWoodDist = dist
      }
    } else if (c.type === 'tree' && c.size >= c.maxSize * 0.8) {
      if (dist < minTreeDist) {
        closestTree = c
        minTreeDist = dist
      }
    }
  }

  if (closestWood) {
    creature.target = closestWood
    creature.state = 'GATHERING'
  } else if (closestTree) {
    creature.target = closestTree
    creature.state = 'HARVESTING'
  } else {
    creature.wander(world)
  }
}
