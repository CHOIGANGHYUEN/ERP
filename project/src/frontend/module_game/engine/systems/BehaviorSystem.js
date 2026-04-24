export class BehaviorSystem {
  constructor(di) {
    this.di = di
  }

  update(deltaTime, world) {
    const scorer = world.utilityScoringService
    
    world.creatures.forEach(creature => {
      if (creature.isDead) return

      // 12. 행동 트리 및 유틸리티 AI 기반 의사 결정
      if (scorer) {
        const nextAction = scorer.getBestAction(creature)
        
        // --- 방향 보정 로직 (Target Facing) ---
        if (creature.target && creature.transform) {
          const dx = creature.target.x - creature.x
          const dy = creature.target.y - creature.y
          const targetRot = Math.atan2(dy, dx)
          // 0.15 속도로 서서히 회전 (생동감 부여)
          const diff = targetRot - creature.transform.rotation
          creature.transform.rotation += Math.atan2(Math.sin(diff), Math.cos(diff)) * 0.15
        }

        // 14. 긴급 오버라이드 체크 (임시: world.isEmergency 기준)
        if (world.isEmergency) {
          creature.state = 'FLEEING'
          return
        }

        if (nextAction !== 'WORK' && creature.state !== nextAction) {
          creature.state = nextAction
          // 작업 중이었다면 작업 해제
          if (creature.currentTask && world.taskBoardService) {
            world.taskBoardService.releaseTask(creature.villageId, creature.currentTask.id)
            creature.currentTask = null
          }
        }
      }

      // 18. 생동감 배회 (Idle Wandering)
      if (creature.state === 'IDLE' && !creature.currentTask && !creature.movement.isMoving && !creature.target) {
        if (Math.random() < 0.01) {
          creature.wander(world)
        }
      }
    })
  }

  /**
   * 13. 이벤트 기반 타겟 검증 (Target Destruction Validation)
   */
  onEntityDestroyed(entityId, world) {
    world.creatures.forEach(creature => {
      if (creature.target && creature.target.id === entityId) {
        creature.target = null
        creature.state = 'IDLE'
        if (creature.currentTask) {
          creature.currentTask = null
        }
      }
    })
  }
}
