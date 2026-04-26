import { MoveTask } from '../objects/tasks/MoveTask.js'
import { HarvestTask } from '../objects/tasks/HarvestTask.js'
import { BuildTask } from '../objects/tasks/BuildTask.js'
import { FarmWorkTask } from '../objects/tasks/FarmWorkTask.js'
import { DepositTask } from '../objects/tasks/DepositTask.js'

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
      if (creature.isDead) return

      // 💡 [큐 제한 강화] 할 일 목록이 5칸이 꽉 차면 더 이상 업무를 찾지 않음 (의사결정 차단)
      const MAX_TASK_QUEUE = 5
      if (creature.taskQueue && creature.taskQueue.length >= MAX_TASK_QUEUE) return

      // 💡 [지속성 및 중복 방지 강화] 업무 진행 중에는 새로운 작업을 찾지 않음
      if (creature.taskQueue && creature.taskQueue.length > 0) return

      // 💡 [초기 직업 자동 배정] 공식 함수를 호출하여 마을 통계(professionCounts)가 누락되지 않게 함
      if (!creature.profession || creature.profession === 'NONE' || creature.profession === 'IDLE') {
        const defaultJobs = ['GATHERER', 'LUMBERJACK', 'BUILDER', 'MINER']
        const hashId = typeof creature.id === 'string' ? creature.id.charCodeAt(0) : (creature.id || Math.floor(Math.random() * 100))
        const newJob = defaultJobs[hashId % defaultJobs.length]
        
        // 💡 JobAssigner를 통해 안전하게 변경
        const assigner = creature.brain.assigner
        if (assigner) assigner.changeProfession(creature, newJob)
        else creature.profession = newJob
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
        // 💡 [중복 방지] 게시판 업무라도 실제 월드 객체가 이미 다른 이에게 타겟팅 되었는지 최종 확인
        const realTarget = world.getEntityById(bestTask.targetId, bestTask.targetType)
        if (realTarget && realTarget.isTargeted) {
          // 이미 누군가 개인 작업으로 선점했다면 게시판에서 이 작업은 일단 패스
          return
        }

        const claimed = bestTask.isPersonal
          ? bestTask
          : taskBoard.claimTask(villageId, bestTask.id, creature.id)

        if (claimed) {
          // 💡 [선점 확정] 업무를 받는 즉시 타겟을 묶어서 다른 사람이 못 건드리게 함
          if (realTarget) realTarget.isTargeted = true
          this.assignTaskChain(creature, claimed, world)
        }
      } else {
        // 일감이 없거나 휴식/방황이 필요할 때 배회 (Fallback)
        if (Math.random() < 0.1) creature.wander(world)
      }
    })
  }

  findBestTask(creature, tasks) {
    if (!tasks || tasks.length === 0) return null
    
    // 💡 [지능 개선] 거리만 보지 않고 우선순위(Priority)를 최우선으로 고려함
    // 1순위: 높은 우선순위 (건설 등), 2순위: 가까운 거리
    let best = tasks[0]
    let highestPriority = -Infinity
    let minDist = Infinity

    tasks.forEach(t => {
      // 💡 [전통 준수] 모닥불(CAMPFIRE)은 오직 리더(LEADER)만 지을 수 있음
      if (t.type === 'BUILD' && t.buildingType === 'CAMPFIRE' && creature.profession !== 'LEADER') {
        return
      }

      const priority = t.priority || 0
      const dx = t.position.x - creature.x
      const dy = t.position.y - creature.y
      const dSq = dx * dx + dy * dy

      if (priority > highestPriority) {
        highestPriority = priority
        minDist = dSq
        best = t
      } else if (priority === highestPriority) {
        if (dSq < minDist) {
          minDist = dSq
          best = t
        }
      }
    })
    return best
  }

  perceivePersonalTask(creature, world) {
    if (!creature.profession || creature.profession === 'NONE') return null

    // 💡 [농부 전문화] 농부는 농장 관리를 최우선으로 함
    if (creature.profession === 'FARMER' && creature.village) {
      const farms = creature.village.buildings.filter(b => b.type === 'FARM' && b.isConstructed && !b.isDead)
      if (farms.length > 0) {
        const farm = farms[0] 
        return {
          id: `farming-${farm.id}`,
          type: 'FARMING',
          targetId: world.buildings.indexOf(farm),
          targetType: 'building',
          isPersonal: true
        }
      }
    }

    const jobTargets = {
      GATHERER: ['plant', 'fruit', 'crop'],
      LUMBERJACK: ['tree'],
      MINER: ['mine', 'stone', 'iron', 'gold'],
      FARMER: ['crop']
    }
    const myTargets = jobTargets[creature.profession]
    if (!myTargets) return null

    const scanRange = creature.perceptionRadius || 800 // 💡 인지 범위 확장 (800px)
    const candidates = world.chunkManager.query({
      x: creature.x - scanRange, y: creature.y - scanRange,
      width: scanRange * 2, height: scanRange * 2
    })

    let bestResource = null
    let minDist = Infinity

    candidates.forEach(obj => {
      if (myTargets.includes(obj.type || obj._type)) {
        if (obj.isTargeted || obj.isDead) return

        // 지형 및 영토 체크
        if (world.terrain) {
          const cols = Math.ceil((world.width || 3200) / 16)
          const tx = Math.floor(obj.x / 16), ty = Math.floor(obj.y / 16)
          
          // 높은 산/바다 속 자원은 무시
          const terrainType = world.terrain[ty * cols + tx]
          if (terrainType === 2 || terrainType >= 4) return

          // 타 마을 영토 내 자원은 무시 (내 땅이거나 주인 없는 땅만 가능)
          if (world.territory) {
            const vIdx = world.villages.includes(creature.village) ? world.villages.indexOf(creature.village) + 1 : 0
            const terrOwner = world.territory[ty * cols + tx]
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

    // [중요] 주변에 일감이 전혀 없으면 즉시 전직 고려 혹은 먼 곳 배회 유도
    if (bestResource) {
      bestResource.isTargeted = true
      creature._noWorkTicks = 0 // 일감 찾음
      return {
        id: `personal-${bestResource.id}`,
        type: 'HARVEST',
        targetId: bestResource.id,
        targetType: bestResource._type || bestResource.type,
        position: { x: bestResource.x, y: bestResource.y },
        isPersonal: true
      }
    } else {
      // 💡 [임시 전직] 본업 일감이 5번 연속 없으면 채집가로 임시 전직하여 식량 확보 지원
      creature._noWorkTicks = (creature._noWorkTicks || 0) + 1
      if (creature._noWorkTicks > 5 && creature.profession !== 'GATHERER' && creature.profession !== 'LEADER') {
         const assigner = creature.brain.assigner
         if (assigner) assigner.changeProfession(creature, 'GATHERER', true)
         creature._noWorkTicks = 0
      }

      // 💡 [Proactive Wander] 근처에 일감이 없으면 멍하니 있지 말고 즉속 먼 곳으로 이동 시도 (확률 40%)
      if (Math.random() < 0.4) {
        creature.wander(world)
      }
    }
    return null
  }
  assignTaskChain(creature, task, world) {
    // 💡 [절대 규칙] 할 일이 하나라도 남아있으면 새로운 업무는 절대 받지 않음
    if (creature.taskQueue && creature.taskQueue.length > 0) return

    const target = world.getEntityById(task.targetId, task.targetType)
    if (!target) return

    // 💡 [로그 최적화] 사소한 업무 시작 로그(broadcast)는 제거하고 머리 위 말풍선만 남김
    const targetInfo = task.targetType || '대상'
    world.showSpeechBubble(creature.id, 'creature', `${targetInfo} ${task.type}!`)

    const range = creature.size + (target.size || 10)

    // 💡 [핵심: 전체 작업 사이클 주입] 이동 -> 채집 -> 복귀 -> 납부
    creature.taskQueue.push(new MoveTask(target, range))

    if (task.type === 'BUILD') {
      creature.taskQueue.push(new BuildTask(target))
    } else if (task.type === 'FARMING') {
      creature.taskQueue.push(new FarmWorkTask(target))
    } else {
      creature.taskQueue.push(new HarvestTask(target))
      
      // 💡 채집 업무인 경우 반드시 마을로 돌아와서 납부하는 과정을 추가
      if (creature.village) {
        // 1. 마을 경계(radius) 혹은 중심점으로 이동
        creature.taskQueue.push(new MoveTask(creature.village, 40)) 
        // 2. 창고에 소지품 납부
        creature.taskQueue.push(new DepositTask(creature.village))
      }
    }

    // 💡 [수정] currentTask를 미리 shift하지 않음
    // CreatureSet.update()가 taskQueue[0]을 직접 execute()하므로 여기서 꺼내면 안 됨
    creature.state = 'WORK'
  }
}
