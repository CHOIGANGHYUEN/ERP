import { MoveTask } from '../../tasks/MoveTask.js'
import { HarvestTask } from '../../tasks/HarvestTask.js'
import { DepositTask } from '../../tasks/DepositTask.js'

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

  let targetToMined = closestWood || closestTree

  if (targetToMined) {
    creature.taskQueue.push(new MoveTask(targetToMined))
    creature.taskQueue.push(new HarvestTask(targetToMined))
    
    // 수확이 끝난 뒤 수확물이 어느 정도 차면 (혹은 항상) 마을로 돌아와 납품하는 태스크 스케줄
    if (creature.village) {
      creature.taskQueue.push(new MoveTask(creature.village, creature.village.radius))
      creature.taskQueue.push(new DepositTask(creature.village))
    }
  } else {
    creature.wander(world)
  }
}
