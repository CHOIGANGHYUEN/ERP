import { MoveTask } from '../../tasks/MoveTask.js'
import { HarvestTask } from '../../tasks/HarvestTask.js'
import { DepositTask } from '../../tasks/DepositTask.js'

export const MINER = (creature, world, candidates) => {
  let closestMine = null,
    minMineDist = Infinity
  for (const c of candidates) {
    // 버그 수정: 광부가 maxEnergy만 보고 주민(Creature)을 광맥으로 오인하여 때려죽이는(Mining) 버그 해결
    // 주민은 profession 속성을 가지고 있으므로 이를 통해 배제합니다.
    if (c.isDead || !c.maxEnergy || c.profession !== undefined) continue
    const dist = creature.distanceTo(c)
    if (dist < minMineDist) {
      closestMine = c
      minMineDist = dist
    }
  }
  if (closestMine) {
    creature.taskQueue.push(new MoveTask(closestMine))
    creature.taskQueue.push(new HarvestTask(closestMine))
    
    if (creature.village) {
      creature.taskQueue.push(new MoveTask(creature.village, creature.village.radius))
      creature.taskQueue.push(new DepositTask(creature.village))
    }
  } else {
    creature.wander(world)
  }
}
