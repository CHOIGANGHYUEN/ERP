import { MoveTask } from '../objects/tasks/MoveTask.js'
import { HarvestTask } from '../objects/tasks/HarvestTask.js'
import { BuildTask } from '../objects/tasks/BuildTask.js'

export class WorkSystem {
  constructor(di) {
    this.di = di
    this.processRate = 1000 // 1초마다 의사결정 (성능 최적화 및 행동 지속성 강화)
    this.timers = new Map()
  }

  update(deltaTime, world) {
    const taskBoard = world.taskBoardService
    if (!taskBoard) return

    world.creatures.forEach(creature => {
      // 1) 상태 및 쿨다운 검사
      // 💡 [버그 수정] 나이(isAdult)와 상관없이 태어나자마자 마을을 짓고 활동하도록 제약 해제
      if (creature.isDead) return

      // 💡 [지속성 강화] 이미 중요한 일을 하고 있으면 의사결정 스킵 (딴짓 방지)
      if (creature.taskQueue.length > 0) return

      // 💡 [초기 직업 자동 배정] 무직인 주민에게 기본 직업을 부여하여 즉각적인 경제/건설 활동 유도
      if (!creature.profession || creature.profession === 'NONE' || creature.profession === 'IDLE') {
        const defaultJobs = ['GATHERER', 'LUMBERJACK', 'BUILDER', 'MINER']
        const hashId = typeof creature.id === 'string' ? creature.id.charCodeAt(0) : (creature.id || Math.floor(Math.random() * 100))
        creature.profession = defaultJobs[hashId % defaultJobs.length]
      }

      let timer = (this.timers.get(creature.id) || 0) + deltaTime
      if (timer < this.processRate) {
        this.timers.set(creature.id, timer)
        return
      }
      this.timers.set(creature.id, 0)

      // 2) [인지 및 판단 트리거]
      if (!creature.state) creature.state = 'IDLE' // 초기 상태 보정
      if (!['WORK', 'IDLE', 'WANDERING'].includes(creature.state)) return

      // 💡 [버그 수정] 아직 마을 등록이 완전히 끝나지 않았어도 개인 작업(벌목 등)은 하도록 완화
      const villageId = creature.village ? world.villages.indexOf(creature.village) : -1

      // 3) [의사결정: 공동 업무 vs 개인 직업 활동]
      const nearbyTasks = villageId !== -1 && taskBoard ? taskBoard.getAvailableTasks(villageId) : []
      let bestTask = null

      // 💡 [버그 수정] 마을에 아직 소속되지 않은 주민이 있을 때 발생하는 치명적 에러 방어
      const inv = creature.village?.inventory || {}
      const pop = creature.village?.creatures?.length || 1
      const isFoodLow = inv.food < pop * 2
      const isLumberLow = inv.wood < pop * 2

      // 💡 [자원 상태 기반 우선순위 동적 변경]
      // 식량이 부족할 때, 식량 관련 직업(FARMER, GATHERER)은 건축보다 채집을 우선함
      if (isFoodLow && ['FARMER', 'GATHERER'].includes(creature.profession)) {
        bestTask = this.perceivePersonalTask(creature, world)
        if (!bestTask && nearbyTasks.length > 0) {
          bestTask = this.findBestTask(creature, nearbyTasks)
        }
      }
      // 목재가 부족할 때, 벌목꾼(LUMBERJACK)은 건축보다 벌목을 우선함
      else if (isLumberLow && creature.profession === 'LUMBERJACK') {
        bestTask = this.perceivePersonalTask(creature, world)
        if (!bestTask && nearbyTasks.length > 0) {
          bestTask = this.findBestTask(creature, nearbyTasks)
        }
      }
      else {
        // 기본적으로는 미완성 건물(BUILD)을 최우선으로 처리
        if (nearbyTasks.length > 0) {
          bestTask = this.findBestTask(creature, nearbyTasks)
        }

        // 공용 업무가 없으면 개인 직업 활동 수행
        if (!bestTask) {
          bestTask = this.perceivePersonalTask(creature, world)
        }
      }

      // 4) [타겟 매칭 & 큐 할당]
      if (bestTask) {
        const claimed = bestTask.isPersonal
          ? bestTask
          : taskBoard.claimTask(villageId, bestTask.id, creature.id)

        if (claimed) {
          this.assignTaskChain(creature, claimed, world)
        }
      } else {
        // 일감이 없거나 휴식/방황이 필요할 때 배회 (Fallback)
        if (Math.random() < 0.1) creature.wander(world)
      }
    })
  }

  findBestTask(creature, tasks) {
    let best = null
    let minDist = Infinity
    tasks.forEach(t => {
      const dx = t.position.x - creature.x
      const dy = t.position.y - creature.y
      const dSq = dx * dx + dy * dy
      if (dSq < minDist) {
        minDist = dSq
        best = t
      }
    })
    return best
  }

  perceivePersonalTask(creature, world) {
    const jobTargets = {
      GATHERER: ['plant', 'fruit', 'crop'],
      LUMBERJACK: ['tree'],
      MINER: ['mine', 'stone', 'iron', 'gold'],
      FARMER: ['crop']
    }
    const myTargets = jobTargets[creature.profession]
    if (!myTargets) return null

    const scanRange = creature.perceptionRadius || 500
    const candidates = world.chunkManager.query({
      x: creature.x - scanRange, y: creature.y - scanRange,
      width: scanRange * 2, height: scanRange * 2
    })

    let bestResource = null
    let minDist = Infinity

    candidates.forEach(obj => {
      if (myTargets.includes(obj.type || obj._type)) {
        if (obj.isTargeted || obj.isDead) return

        if (world.terrain) {
          const cols = Math.ceil((world.width || 3200) / 16)
          const tx = Math.floor(obj.x / 16), ty = Math.floor(obj.y / 16)
          const terrainType = world.terrain[ty * cols + tx]
          if (terrainType === 2 || terrainType >= 3) return

          // 💡 [활동 범위 제한] 전사나 탐험가가 아니면 남의 영토 밖의 자원은 무시
          const isScout = ['WARRIOR', 'EXPLORER'].includes(creature.profession)
          if (!isScout && world.territory) {
            const vIdx = world.villages.indexOf(creature.village) + 1
            const terrOwner = world.territory[ty * cols + tx]
            // 💡 [수집 범위 완화] 마을 영토가 아직 좁을 수 있으므로 내 땅이거나 주인이 없는 땅(0)이면 허용!
            if (terrOwner !== vIdx && terrOwner !== 0) return
          }
        }

        const dx = obj.x - creature.x
        const dy = obj.y - creature.y
        const dSq = dx * dx + dy * dy
        if (dSq < minDist) {
          minDist = dSq
          bestResource = obj
        }
      }
    })

    if (bestResource) {
      bestResource.isTargeted = true
      return {
        id: `personal-${bestResource.id}`,
        type: 'HARVEST',
        targetId: bestResource.id,
        targetType: bestResource._type || bestResource.type,
        position: { x: bestResource.x, y: bestResource.y },
        isPersonal: true
      }
    }
    return null
  }

  assignTaskChain(creature, task, world) {
    const target = world.getEntityById(task.targetId, task.targetType)
    if (!target) return

    // 💡 [핵심 수정] 기존 순수 객체 방식 → BaseTask 인스턴스로 교체
    // CreatureSet.update()가 taskQueue[0].execute()를 호출하므로 반드시 BaseTask 인스턴스여야 함
    creature.taskQueue = []

    // 말풍선 & 이벤트 방송
    const shortId = String(creature.id).substring(0, 4)
    const targetInfo = task.targetType || '대상'
    world.broadcastEvent(`[${creature.profession}] ${shortId} -> ${task.type} (${targetInfo})`, '#f1c40f')
    world.showSpeechBubble(creature.id, 'creature', `${targetInfo} ${task.type}!`)

    const range = creature.size + (target.size || 10)

    // 💡 [수정] BaseTask 인스턴스 사용 (execute() 메서드 보유)
    creature.taskQueue.push(new MoveTask(target, range))

    if (task.type === 'BUILD') {
      creature.taskQueue.push(new BuildTask(target))
    } else {
      creature.taskQueue.push(new HarvestTask(target))
    }

    // 💡 [수정] currentTask를 미리 shift하지 않음
    // CreatureSet.update()가 taskQueue[0]을 직접 execute()하므로 여기서 꺼내면 안 됨
    creature.state = 'WORK'
  }
}
