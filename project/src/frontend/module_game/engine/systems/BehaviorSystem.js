export class BehaviorSystem {
  constructor(di) {
    this.di = di
  }

  update(deltaTime, world) {
    const scorer = world.utilityScoringService

    world.creatures.forEach(creature => {
      if (creature.isDead) return

      // 💡 [역할 정리] BehaviorSystem은 방향 보정, 긴급 오버라이드, Idle 배회만 담당합니다.
      // taskQueue 실행은 CreatureSet.update()가 taskQueue[0].execute()로 처리합니다.

      // --- 방향 보정 로직 (Target Facing) ---
      if (creature.target && creature.transform) {
        const dx = creature.target.x - creature.x
        const dy = creature.target.y - creature.y
        const targetRot = Math.atan2(dy, dx)
        const diff = targetRot - creature.transform.rotation
        creature.transform.rotation += Math.atan2(Math.sin(diff), Math.cos(diff)) * 0.15
      }

      // 긴급 오버라이드 체크
      if (world.isEmergency) {
        creature.state = 'FLEEING'
        return
      }

      // 유틸리티 AI 기반 의사 결정은 현재 생존 로직이 CreatureEmotion(Task Queue 방식)으로
      // 고도화되면서 충돌을 막기 위해 상태 강제 변경(EAT, REST) 로직을 비활성화합니다.
      // (WorkSystem과 CreatureSet이 각각 업무와 생존을 전담)

      // Idle 배회 (taskQueue가 비어있고 대기 중일 때만)
      if (creature.state === 'IDLE' &&
          (!creature.taskQueue || creature.taskQueue.length === 0) &&
          !creature.movement?.isMoving && !creature.target) {
        if (Math.random() < 0.01) {
          creature.wander(world)
        }
      }
    })
  }

  /**
   * 이벤트 기반 타겟 검증 (Target Destruction Validation)
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
