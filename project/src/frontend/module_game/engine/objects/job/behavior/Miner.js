export const MINER = (creature, world, candidates) => {
  let closestMine = null,
    minMineDist = Infinity
  for (const c of candidates) {
    if (c.isDead || !c.maxEnergy) continue
    const dist = creature.distanceTo(c)
    if (dist < minMineDist) {
      closestMine = c
      minMineDist = dist
    }
  }
  if (closestMine) {
    creature.target = closestMine
    creature.state = 'MINING'
  } else {
    creature.wander(world)
  }
}
