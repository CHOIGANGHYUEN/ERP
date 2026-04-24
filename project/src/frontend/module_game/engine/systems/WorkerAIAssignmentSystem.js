export class WorkerAIAssignmentSystem {
  constructor(di) {
    this.di = di
  }

  update(deltaTime, world) {
    const taskBoard = world.taskBoardService
    const blacklist = world.blacklistService
    if (!taskBoard) return

    // 유휴 상태인 주민들 필터링
    const idleWorkers = world.creatures.filter(c => 
      !c.isDead && 
      c.isAdult && 
      (!c.currentTask || c.currentTask.type === 'IDLE')
    )

    if (idleWorkers.length === 0) return

    world.villages.forEach(village => {
      const vId = world.villages.indexOf(village)
      const availableTasks = taskBoard.getAvailableTasks(vId)

      if (availableTasks.length === 0) return

      // 각 작업에 대해 가장 가까운 워커 매핑 (Proximity-based Assignment)
      availableTasks.forEach(task => {
        // 블랙리스트 체크
        if (blacklist && task.targetId && blacklist.isBlacklisted(task.targetId)) {
          return
        }

        let bestWorker = null
        let minPlayerDist = Infinity

        idleWorkers.forEach(worker => {
          if (worker.village !== village) return

          const dx = worker.x - task.position.x
          const dy = worker.y - task.position.y
          const distSq = dx * dx + dy * dy

          if (distSq < minPlayerDist) {
            minPlayerDist = distSq
            bestWorker = worker
          }
        })

        if (bestWorker) {
          const claimed = taskBoard.claimTask(vId, task.id, bestWorker.id)
          if (claimed) {
            // 워커에게 작업 주입 (Task Injection)
            bestWorker.setTask(claimed)
            // 할당된 워커는 유휴 목록에서 제외
            const idx = idleWorkers.indexOf(bestWorker)
            if (idx !== -1) idleWorkers.splice(idx, 1)
          }
        }
      })
    })
  }

  /**
   * 실패 복구 및 대안 탐색
   */
  findAlternativeTarget(worker, failedTask, world) {
    // 9번 기능: 작업 실패 시 즉시 다른 타겟 부여
    // 10번 기능: 실패한 타겟은 블랙리스트 등록
    if (failedTask.targetId && world.blacklistService) {
      world.blacklistService.add(failedTask.targetId)
    }
    
    // 유휴 상태로 전환하여 다음 update 틱에서 자동 재할당 유도
    worker.currentTask = null
  }
}
