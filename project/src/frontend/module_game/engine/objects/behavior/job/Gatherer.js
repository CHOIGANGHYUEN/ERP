export const GATHERER = (creature, world, candidates) => {
  let closestRes = null,
    minResDist = Infinity
  let closestGrass = null,
    minGrassDist = Infinity

  for (const c of candidates) {
    if (c.isDead) continue
    const dist = creature.distanceTo(c)
    if (c.type === 'biomass' || c.type === 'food') {
      if (dist < minResDist) {
        closestRes = c
        minResDist = dist
      }
    } else if (c.type === 'grass') {
      if (dist < minGrassDist) {
        closestGrass = c
        minGrassDist = dist
      }
    }
  }

  if (closestRes) {
    creature.target = closestRes
    creature.state = 'GATHERING'
  } else if (closestGrass) {
    creature.target = closestGrass
    creature.state = 'HARVESTING'
  } else {
    creature.wander(world)
  }
}
