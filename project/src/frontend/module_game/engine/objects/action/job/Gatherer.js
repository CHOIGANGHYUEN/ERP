import { MoveTask } from '../../tasks/MoveTask.js'
import { HarvestTask } from '../../tasks/HarvestTask.js'
import { DepositTask } from '../../tasks/DepositTask.js'

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

  let targetToMined = closestRes || closestGrass

  if (targetToMined) {
    creature.taskQueue.push(new MoveTask(targetToMined))
    creature.taskQueue.push(new HarvestTask(targetToMined))
    
    if (creature.village) {
      creature.taskQueue.push(new MoveTask(creature.village, creature.village.radius))
      creature.taskQueue.push(new DepositTask(creature.village))
    }
  } else {
    creature.wander(world)
  }
}
