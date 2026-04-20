import { CreatureEmotion, DRIVE } from '../emotions/CreatureEmotion.js'
import { CreatureActions } from '../action/CreatureActions.js'
import { CreatureRenders } from '../renders/CreatureRenders.js'
import { JobAssigner } from '../action/JobAssigner.js'

export const CreatureSet = {
  emotion: CreatureEmotion,
  action: CreatureActions,
  render: CreatureRenders,
  assigner: JobAssigner,

  init: (creature) => {
    console.log(`🐣 [Creature: ${creature.id}] 초기화됨`)
    CreatureEmotion.init(creature)
  },

  update: (creature, deltaTime, world) => {
    try {
      // 💡 [프리징 원천 차단 3] 붕괴된 NaN 좌표를 가진 개체가 공간 탐색 엔진을 마비시키는 것을 사전에 방어하고 소거
      if (Number.isNaN(creature.x) || Number.isNaN(creature.y)) {
        console.error(
          `🚨 [NaN Poisoning] ID ${creature.id} 좌표 붕괴 감지. 강제 제거하여 시스템을 보호합니다.`,
        )
        creature.isDead = true
        return
      }

      if (CreatureEmotion.update(creature, deltaTime, world)) return

      // AI 연산 분산 타이머 (생존 욕구 및 일거리 판단)
      creature.aiTickTimer -= deltaTime
      if (creature.aiTickTimer <= 0) {
        creature.aiTickTimer = 500 + Math.random() * 500

        // --- AI TICK 시작 ---
        // console.groupCollapsed(`🧠 [AI TICK] Creature: ${creature.id} (${creature.profession})`);

        // 직업 자동 배정
        JobAssigner.assignProfession(creature, world)

        // 마을 내 식량 자동 섭취
        if (creature.village && creature.needs.hunger > 50 && creature.village.inventory.food > 0) {
          if (creature.distanceTo(creature.village) < creature.village.radius) {
            creature.village.inventory.food--
            CreatureEmotion.fulfillHunger(creature)
          }
        }

        // 💡 [프리징/무한루프 방지] 집 탐색(A* 연산 폭탄) 10초 쿨타임 적용
        const now = Date.now()
        if (
          creature.isAdult &&
          !creature.home &&
          creature.village &&
          (!creature._lastHomeSearch || now - creature._lastHomeSearch > 10000)
        ) {
          creature._lastHomeSearch = now
          creature.findHome(world)
        }

        // 1. 생존 욕구 평가 및 주입
        const survivalDrive = CreatureEmotion.evaluateSurvivalNeeds(creature, world)
        if (survivalDrive && survivalDrive.type !== DRIVE.NONE) {
          creature.taskQueue = [] // 강제 전환
          const injector = CreatureActions.SurvivalInjectors[survivalDrive.type]
          if (injector) injector(creature, survivalDrive.payload, world)
        }
        // 2. 생존 우선순위가 아니면 직업 행동 탐색
        else if (
          creature.taskQueue.length === 0 &&
          ['IDLE', 'WANDERING'].includes(creature.state)
        ) {
          const jobInjector = CreatureActions.JobInjectors[creature.profession]
          if (jobInjector) {
            // console.log(`🛠️ [Creature: ${creature.id}] 직업 활동 탐색 중 (${creature.profession})`);
            const searchRange = {
              x: creature.x - 300,
              y: creature.y - 300,
              width: 600,
              height: 600,
            }
            const candidates = world.chunkManager.query(searchRange)
            jobInjector(creature, world, candidates)
          } else {
            creature.wander(world)
          }
        }
        // console.groupEnd();
      }

      // 3. SUFFERING (허기/고통 시각화 상태 전환)
      if (
        creature.needs.hunger >= 90 &&
        creature.state !== 'EATING' &&
        creature.state !== 'FLEEING' &&
        creature.state !== 'ATTACKING'
      ) {
        creature.state = 'SUFFERING'
      } else if (creature.state === 'SUFFERING' && creature.needs.hunger < 85) {
        creature.state = 'WANDERING'
      }

      // Task Queue 기반 행동 실행 처리
      if (creature.taskQueue.length > 0) {
        const currentTask = creature.taskQueue[0]
        const status = currentTask.safeExecute(creature, deltaTime, world)

        if (status === 'COMPLETED' || status === 'FAILED') {
          creature.taskQueue.shift()

          if (status === 'FAILED') {
            if (currentTask.failReason === 'NO_FOOD') {
              JobAssigner.changeProfession(creature, 'GATHERER', true) // 임시 전직

              creature.taskQueue = []
              creature.state = 'WANDERING'
              creature._failCount = 0

              const idx = world.creatures.indexOf(creature)
              if (idx !== -1) world.showSpeechBubble(idx, 'creature', '🌾식량 구하러 함!', 2000)
            } else {
              creature._failCount = (creature._failCount || 0) + 1

              if (creature._failCount >= 3) {
                creature.taskQueue = []
                creature.state = 'WANDERING'
                creature._failCount = 0

                const idx = world.creatures.indexOf(creature)
                if (idx !== -1) world.showSpeechBubble(idx, 'creature', '❓', 2000)

                if (creature.originalProfession) {
                  JobAssigner.changeProfession(creature, creature.originalProfession, false) // 복귀
                }
              }
            }
          } else if (status === 'COMPLETED') {
            creature._failCount = 0
          }

          if (creature.taskQueue.length === 0) {
            if (creature.state !== 'WANDERING') creature.state = 'IDLE'

            if (status === 'COMPLETED' && creature.originalProfession) {
              JobAssigner.changeProfession(creature, creature.originalProfession, false) // 복귀

              const idx = world.creatures.indexOf(creature)
              if (idx !== -1) world.showSpeechBubble(idx, 'creature', `✨본업 복귀!`, 2000)
            }
          }
        }
      } else {
        if (creature.state === 'WANDERING' && creature.targetX != null) {
          if (creature.distanceTo({ x: creature.targetX, y: creature.targetY }) > 5) {
            creature.moveToTarget(creature.targetX, creature.targetY, deltaTime, world)
          } else {
            creature.state = 'IDLE'
          }
        }
      }

      const stateAction = CreatureActions.StateExecutors[creature.state]
      if (stateAction) {
        stateAction(creature, deltaTime, world)
      }
    } catch (e) {
      if (creature) {
        creature._errorCount = (creature._errorCount || 0) + 1
        console.error(
          `🚨 [CreatureSet Update Error] ID: ${creature.id} (누적: ${creature._errorCount})`,
          e,
        )

        if (creature._errorCount < 3) {
          creature.taskQueue = []
          creature.state = 'WANDERING'
        } else if (creature._errorCount === 3) {
          console.error(`💀 [Fatal] ID ${creature.id} 무한 오류로 인한 강제 제거 처리`)
          creature.isDead = true
        }
      }
    }
  },

  draw: (creature, ctx, timestamp, world) => {
    try {
      const renderFunc = CreatureRenders[creature.state]
      if (renderFunc) {
        renderFunc(creature, ctx, timestamp, world)
      }
    } catch (e) {
      console.error(`🎨 [Draw Error] Creature: ${creature.id}`, e)
    }
  },
}
