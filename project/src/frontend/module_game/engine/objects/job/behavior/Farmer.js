export const FARMER = (creature, world, candidates) => {
  let closestCrop = null,
    minCropDist = Infinity
  let closestFood = null,
    minFoodDist = Infinity

  for (const c of candidates) {
    if (c.isDead) continue
    const dist = creature.distanceTo(c)
    if (c.type === 'crop' && c.size >= c.maxSize * 0.8) {
      if (dist < minCropDist) {
        closestCrop = c
        minCropDist = dist
      }
    } else if (c.type === 'food' || c.type === 'biomass') {
      if (dist < minFoodDist) {
        closestFood = c
        minFoodDist = dist
      }
    }
  }

  if (closestCrop) {
    creature.target = closestCrop
    creature.state = 'HARVESTING'
    return
  }
  if (closestFood && Math.random() < 0.5) {
    creature.target = closestFood
    creature.state = 'GATHERING'
    return
  }

  if (creature.village && world.currentFertility >= 30 && Math.random() < 0.3) {
    const px = creature.village.x + (Math.random() - 0.5) * 150
    const py = creature.village.y + (Math.random() - 0.5) * 150
    world.spawnPlant(px, py, 'crop')
    world.currentFertility -= 30
    creature.wander(world)
  } else {
    creature.wander(world)
  }
}
