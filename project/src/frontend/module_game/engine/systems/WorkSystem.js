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
      if (creature.isDead || !creature.isAdult) return
      
      // 💡 [지속성 강화] 이미 중요한 일을 하고 있으면 의사결정 스킵 (딴짓 방지)
      if (creature.taskQueue.length > 0) return

      let timer = (this.timers.get(creature.id) || 0) + deltaTime
      if (timer < this.processRate) {
        this.timers.set(creature.id, timer)
        return
      }
      this.timers.set(creature.id, 0)

      // 2) [인지 및 판단 트리거]
      if (!['WORK', 'IDLE', 'WANDERING'].includes(creature.state)) return

      const villageId = world.villages.indexOf(creature.village)
      if (villageId === -1) return

      // 3) [타겟 스캔 로직]
      const nearbyTasks = taskBoard.getAvailableTasks(villageId)
      let bestTask = null

      // 💡 [건축 우선 원칙] 마을 발전을 위해 미완성 건물을 무조건 최우선으로 처리함
      // 개인 채집 활동(Harvest)보다 건축(Build)이 지리적으로 조금 멀더라도 건축에 우선 전념함
      if (nearbyTasks.length > 0) {
        bestTask = this.findBestTask(creature, nearbyTasks)
      } 
      
      // 공용 업무(건축 등)가 없을 때만 개인 직업 활동 수행
      if (!bestTask) {
        bestTask = this.perceivePersonalTask(creature, world)
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
        // 일감이 없으면 가끔 배회 (Fallback)
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

          // 💡 [활동 범위 제한] 전사나 탐험가가 아니면 마을 영토 밖의 자원은 무시
          const isScout = ['WARRIOR', 'EXPLORER'].includes(creature.profession)
          if (!isScout && world.territory) {
            const vIdx = world.villages.indexOf(creature.village) + 1
            if (world.territory[ty * cols + tx] !== vIdx) return
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

    creature.taskQueue = []
    
    // 💡 [AI Communication] 콘솔 로그 대신 실시간 인게임 이벤트로 방송
    const shortId = creature.id.substring(0, 4)
    const targetInfo = task.targetType || '대상'
    const msg = `[${creature.profession}] ${shortId} -> ${task.type} (${targetInfo})`
    world.broadcastEvent(msg, '#f1c40f')
    
    // 말풍선으로도 표현하여 현장감 극대화
    world.showSpeechBubble(creature.id, 'creature', `${targetInfo} ${task.type}!`)

    const range = creature.size + (target.size || 10)
    creature.taskQueue.push(new MoveTask(target, range))

    if (task.type === 'BUILD') {
      creature.taskQueue.push(new BuildTask(target))
    } else {
      creature.taskQueue.push(new HarvestTask(target))
    }
    
    creature.currentTask = creature.taskQueue[0]
    creature.state = 'WORK'
  }
}
