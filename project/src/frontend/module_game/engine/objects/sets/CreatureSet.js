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
    CreatureEmotion.init(creature)
  },

  update: (creature, deltaTime, world) => {
    if (CreatureEmotion.update(creature, deltaTime, world)) return

    // AI 연산 분산 타이머 (생존 욕구 및 일거리 판단)
    creature.aiTickTimer -= deltaTime
    if (creature.aiTickTimer <= 0) {
      creature.aiTickTimer = 500 + Math.random() * 500

      // 마을 내 식량 자동 섭취
      if (creature.village && creature.needs.hunger > 50 && creature.village.inventory.food > 0) {
        if (creature.distanceTo(creature.village) < creature.village.radius) {
          creature.village.inventory.food--
          CreatureEmotion.fulfillHunger(creature)
        }
      }

      // [Optimization] 집 없는 성인 주민 집 찾기 시도 (AI Tick으로 이동)
      if (creature.isAdult && !creature.home && creature.village) {
        creature.findHome(world)
      }

      // 1. 생존 욕구 평가 및 주입(Injection)
      const survivalDrive = CreatureEmotion.evaluateSurvivalNeeds(creature, world)
      if (survivalDrive && survivalDrive.type !== DRIVE.NONE) {
        creature.taskQueue = [] // 강제 전환
        const injector = CreatureActions.SurvivalInjectors[survivalDrive.type]
        if (injector) injector(creature, survivalDrive.payload, world)
      } 
      // 2. 생존 우선순위가 아니면 직업 행동 탐색
      else if (creature.taskQueue.length === 0) {
        const searchRange = { x: creature.x - 800, y: creature.y - 800, width: 1600, height: 1600 }
        const candidates = world.chunkManager.query(searchRange)

        const jobInjector = CreatureActions.JobInjectors[creature.profession]
        if (jobInjector) {
          jobInjector(creature, world, candidates)
        } else {
          creature.wander(world)
        }
      }
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
      const status = currentTask.execute(creature, deltaTime, world)

      if (status === 'COMPLETED' || status === 'FAILED') {
        creature.taskQueue.shift()
        if (creature.taskQueue.length === 0) {
          creature.state = 'IDLE' // 태스크 종료
        }
      }
    } else {
      // 큐가 비어 있고 할 일이 없으면 목적지까지 배회(Wandering)
      if (creature.state === 'WANDERING' && creature.targetX != null) {
        if (creature.distanceTo({ x: creature.targetX, y: creature.targetY }) > 5) {
          creature.moveToTarget(creature.targetX, creature.targetY, deltaTime, world)
        } else {
          creature.state = 'IDLE'
        }
      }
    }

    // Legacy Action State Executors (Trading, Suffering 등)
    const stateAction = CreatureActions.StateExecutors[creature.state]
    if (stateAction) {
      stateAction(creature, deltaTime, world)
    }
  },

  draw: (creature, ctx, timestamp, world) => {
    const renderFunc = CreatureRenders[creature.state]
    if (renderFunc) {
      renderFunc(creature, ctx, timestamp, world)
    }
  }
}
