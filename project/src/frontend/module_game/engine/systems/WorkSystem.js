import { MoveTask } from '../objects/tasks/MoveTask.js'
import { HarvestTask } from '../objects/tasks/HarvestTask.js'
import { BuildTask } from '../objects/tasks/BuildTask.js'

export class WorkSystem {
  constructor(di) {
    this.di = di
    this.processRate = 500 // 0.5초마다 일감 검출 (성능 최적화)
    this.timers = new Map()
  }

  update(deltaTime, world) {
    const taskBoard = world.taskBoardService
    if (!taskBoard) return

    world.creatures.forEach(creature => {
      // 1) 고장 방지: 죽었거나 아기가 아니며, 현재 수행중인 작업이 없을 때만 개입
      if (creature.isDead || !creature.isAdult || creature.taskQueue.length > 0) return

      // 2) 성능 최적화: 개체별로 루프 주기를 다르게 가져감
      let timer = (this.timers.get(creature.id) || 0) + deltaTime
      if (timer < this.processRate) {
        this.timers.set(creature.id, timer)
        return
      }
      this.timers.set(creature.id, 0)

      // 3) UtilityScoring 연동: 현재 상태가 'WORK'인 경우에만 일감 찾기
      if (creature.state !== 'WORK' && creature.state !== 'IDLE' && creature.state !== 'WANDERING') return

      const villageId = creature.villageId
      if (villageId === undefined) return

      // 4) 게시판에서 가용 작업 조회
      const tasks = taskBoard.getAvailableTasks(villageId)
      if (tasks.length === 0) {
        // 일감이 없으면 가끔 배회 (Idle Behavioral wandering)
        if (Math.random() < 0.1) creature.wander(world)
        return
      }

      // 5) 가장 가까운 작업 선택 (Proximity-based selection)
      let bestTask = null
      let minDist = Infinity
      
      tasks.forEach(t => {
        const dx = t.position.x - creature.x
        const dy = t.position.y - creature.y
        const dSq = dx * dx + dy * dy
        if (dSq < minDist) {
          minDist = dSq
          bestTask = t
        }
      })

      if (bestTask) {
        const claimed = taskBoard.claimTask(villageId, bestTask.id, creature.id)
        if (claimed) {
          this.assignTaskChain(creature, claimed, world)
        }
      }
    })
  }

  assignTaskChain(creature, task, world) {
    // 💡 [핵심 원칙 1: 아키텍처 엄수] Task Chain 주입
    // MoveTask (이동) -> 구체적 행동(Build/Harvest) 순서로 큐에 삽입
    
    // 타겟 엔티티 가져오기
    const target = world.getEntityById(task.targetId, task.targetType)
    if (!target) return

    // 1. 이동 작업
    const range = creature.size + (target.size || 10)
    creature.taskQueue.push(new MoveTask(target, range))

    // 2. 구체적 행동 작업 연동
    if (task.type === 'BUILD') {
      creature.taskQueue.push(new BuildTask(target))
    } else if (task.type === 'HARVEST' || task.type === 'COLLECT') {
      creature.taskQueue.push(new HarvestTask(target))
    }
    
    // 상태 동기화
    creature.state = 'WORK'
    creature.currentTask = creature.taskQueue[0]
  }
}
