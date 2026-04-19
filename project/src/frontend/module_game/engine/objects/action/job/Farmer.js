import { MoveTask } from '../../tasks/MoveTask.js'
import { HarvestTask } from '../../tasks/HarvestTask.js'
import { DepositTask } from '../../tasks/DepositTask.js'

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
    creature.taskQueue.push(new MoveTask(closestCrop))
    creature.taskQueue.push(new HarvestTask(closestCrop))
    if (creature.village) {
      creature.taskQueue.push(new MoveTask(creature.village, creature.village.radius))
      creature.taskQueue.push(new DepositTask(creature.village))
    }
    return
  }
  if (closestFood && Math.random() < 0.5) {
    creature.taskQueue.push(new MoveTask(closestFood))
    creature.taskQueue.push(new HarvestTask(closestFood))
    if (creature.village) {
      creature.taskQueue.push(new MoveTask(creature.village, creature.village.radius))
      creature.taskQueue.push(new DepositTask(creature.village))
    }
    return
  }

  if (creature.village && world.currentFertility >= 30 && Math.random() < 0.3) {
    const px = creature.village.x + (Math.random() - 0.5) * 150
    const py = creature.village.y + (Math.random() - 0.5) * 150
    world.spawnPlant(px, py, 'crop')
    world.currentFertility -= 30
    creature.wander(world)
  } else {
    // [버그④ 수정] 비옥도 부족 시 채집가처럼 biomass/food 자원을 수집
    let fallbackTarget = null
    let minDist = Infinity
    for (const c of candidates) {
      if (c.isDead) continue
      if (c.type === 'biomass' || c.type === 'food') {
        const dist = creature.distanceTo(c)
        if (dist < minDist) {
          minDist = dist
          fallbackTarget = c
        }
      }
    }
    if (fallbackTarget) {
      creature.taskQueue.push(new MoveTask(fallbackTarget))
      creature.taskQueue.push(new HarvestTask(fallbackTarget))
      if (creature.village) {
        creature.taskQueue.push(new MoveTask(creature.village, creature.village.radius))
        creature.taskQueue.push(new DepositTask(creature.village))
      }
    } else {
      creature.wander(world)
    }
  }
}
