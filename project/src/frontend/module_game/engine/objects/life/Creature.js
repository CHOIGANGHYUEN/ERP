import { Entity } from '../../core/Entity.js'
import { CreatureSet } from '../sets/CreatureSet.js'
import { FamilySystem } from '../../systems/FamilySystem.js'

export class Creature extends Entity {
  init(x, y) {
    // init log removed
    super.init(x, y)
    
    // ■ 1단계: 순수 데이터 계층 (Entity Component)
    this.transform = { x, y, rotation: 0 }
    this.movement = {
      speed: 100 * (1.0 + Math.random() * 0.5), // 기본 이동 속도 (픽셀/초)
      velocity: { x: 0, y: 0 },
      path: [],
      currentWaypointIndex: 0,
      isMoving: false
    }
    this.collider = { radius: 10 }
    
    this.size = 16

    // Age and Life stage
    this.age = 0 // In game "years", 1 real second = 1 game year
    this.isAdult = false
    this.energy = 100
    this.maxEnergy = 100
    this.profession = 'NONE' // NONE, GATHERER, LUMBERJACK, FARMER, BUILDER, SCHOLAR, WARRIOR, MINER, LEADER

    this.speed = 1.0 + Math.random() * 0.5
    this.state = 'IDLE' // 💡 [버그 수정] 스폰 시 즉시 행동 판단을 받기 위해 IDLE로 시작
    this.target = null
    this.village = null // 所属 마을

    this.currentFrame = 0
    this.frameInterval = 125
    this.lastFrameTime = 0
    this.frameOffsets = [0, -2, -4, -2, 0] // 5프레임 사이클

    const colors = ['#e74c3c', '#3498db', '#9b59b6', '#e67e22']
    this.color = colors[Math.floor(Math.random() * colors.length)]

    this.inventory = { wood: 0, biomass: 0, food: 0, stone: 0, iron: 0, gold: 0 }
    
    // 업무 스케줄러 큐
    this.taskQueue = []
    this.poopTimer = 5000 + Math.random() * 10000 // 5~15초마다 배변
    this.aiTickTimer = Math.random() * 1000 // 4.3 최적화: 개체별 AI 연산 분산 타이머

    // 전투 관련 스탯 추가
    this.attackPower = 1.0
    this.matingCooldown = 0 // 짝짓기 쿨다운
    this.home = null // 거주지
    this.level = 1
    this.exp = 0
    this.maxExp = 100
    this.workEfficiency = 1.0 // 작업 및 채집/공격 속도 배율

    // 가문(Family) 시스템
    this.familyName = ''
    this.familyId = 0
    this.tradeTimer = 0 // MERCHANT 교역 타이머

    // 16. 공간 기억 (Spatial Memory)
    this.spatialMemory = [] // { type, x, y, time }

    this.brain.init(this)
    FamilySystem.assignFamily(this)
  }

  get brain() { return CreatureSet }

  update(deltaTime, world) {
    if (this.isDead) return

    // [SAB 수정] 애니메이션 프레임 업데이트 로직
    this.lastFrameTime += deltaTime
    if (this.lastFrameTime >= this.frameInterval) {
      this.currentFrame = (this.currentFrame + 1) % 5
      this.lastFrameTime = 0
    }

    // 수명 및 성장 시스템
    this.age += deltaTime / 1000 // 1초에 1살씩 먹음 (테스트를 위해 빠르게 설정)
    
    if (!this.isAdult) {
      this.size = 8 // 아기 크기 (성인의 절반)
      if (this.age >= 18) { // 18세가 되면 성인으로 성장
        this.isAdult = true
        this.size = 16
        this.brain.assigner.assignProfession(this, world)
        
        // 성장 알림
        const idx = world.creatures.indexOf(this)
        if (idx !== -1) {
          world.showSpeechBubble(idx, 'creature', `✨ 성인이 되었습니다!`, 3000)
        }
      }
    }

    // 자연 회복
    if (this.state !== 'ATTACKING' && this.state !== 'FLEEING') {
      this.energy = Math.min(this.maxEnergy, this.energy + deltaTime * 0.002)
    }

    // 짝짓기 쿨다운 감소
    if (this.matingCooldown > 0) this.matingCooldown -= deltaTime

    // 배변을 통해 대지의 비옥도 회복
    this.poopTimer -= deltaTime
    if (this.poopTimer <= 0) {
      this.poopTimer = 5000 + Math.random() * 10000
      world.addFertility(200)
    }

    if (!this.isAdult) {
      // 아기일 때는 배회만 함
      if (Math.random() < 0.02 && !this.movement.isMoving) {
        this.targetX = this.x + (Math.random() - 0.5) * 100
        this.targetY = this.y + (Math.random() - 0.5) * 100
        this.movement.isMoving = true // 시스템이 이를 감지하여 경로를 생성할 것임
      }
      return
    }

    // 상태(State) 기반 렌더링 보정 (경험치 흭득)
    if (['GATHERING', 'HARVESTING', 'MINING', 'BUILDING', 'ATTACKING'].includes(this.state)) {
      this.gainExp(deltaTime * 0.05, world)
    }

    // [New Architecture] 중앙 제어 시스템 업데이트
    if (world.movementSystem) {
      world.movementSystem.updateEntity(this, deltaTime, world)
    }

    // Brain 세트에 핵심 스케줄링 및 행동 렌더 로직 위임
    this.brain.update(this, deltaTime, world)
  }

  gainExp(amount, world) {
    if (!this.isAdult || this.isDead) return
    this.exp += amount
    if (this.exp >= this.maxExp) {
      this.level++
      this.exp -= this.maxExp
      this.maxExp = Math.floor(this.maxExp * 1.5)
      this.attackPower += 0.5
      this.workEfficiency += 0.2 // 채집 및 작업 속도 20% 증가
      this.speed += 0.1

      // [Optimization] 전수 조사(O(N)) 대신 고유 ID 사용 및 레벨업 메세지 최적화
      // 인구수가 많을 때 메인 스레드 메세지 큐 병목 방지를 위해 특정 레벨 단위로만 출력
      if (this.level % 5 === 0 || this.level < 10) {
        world.showSpeechBubble(this.id, 'creature', `⭐ Lv.${this.level} 달성!`, 3000)
      }
      world.spawnParticle(this.x, this.y, { color: '#f1c40f', count: 15, speed: 60 }) // 레벨업 파티클
    }
  }

  // [Optimization] 전수 조사(O(N)) 방식에서 마을 캐시 활용 방식(O(1))으로 변경
  findHome(_world) {
    if (!this.village || this.home) return

    // 마을이 관리하는 빈 집 캐시에서 즉시 할당
    if (this.village.availableHouses && this.village.availableHouses.length > 0) {
      const house = this.village.availableHouses.pop() // 목록에서 하나 꺼냄
      if (house) {
        this.home = house
        if (!house.occupants.includes(this)) house.occupants.push(this)
      }
    }
  }

  moveToTarget(tx, ty, deltaTime, world) {
    // 목표가 이미 설정되어 있고, 거정도가 매우 가깝다면 리셋하지 않음 (지그재그 및 멈춤 방지)
    if (this.targetPos && Math.abs(this.targetPos.x - tx) < 5 && Math.abs(this.targetPos.y - ty) < 5) {
      this.movement.isMoving = true
      return
    }

    // 이제 능동적으로 이동하지 않고, targetPos만 설정하여 시스템이 처리하도록 위임
    this.targetPos = { x: tx, y: ty }
    this.movement.isMoving = true
    this.movement.currentWaypointIndex = 0
    this.movement.path = [] // 새 목표이므로 경로 초기화 (MovementSystem이 다음 틱에 재생성)
  }

  assignProfession(world) {
    this.brain.assigner.assignProfession(this, world)
  }

  // Creature 단일 개체의 findWork는 삭제되거나 우회할 수 있지만
  // 혹시 직접 스크립트되는 곳을 위해 감쌉니다.
  findWork(world) {
    // 이제 Brain이 자동으로 실행하므로 빈자리로 두거나 유지
  }

  wander(world, customRadius = null) {
    // [Override Guard] 이미 명확한 목표가 있거나 이동 중이라면 배회하지 않음
    if (this.currentTask || this.movement.isMoving || (this.state !== 'IDLE' && this.state !== 'WANDERING')) {
      return
    }

    // 지그재그 버그 수정: 배회 중에 새로운 일거리가 없다면, 아직 배회 목적지에 도착하지 않은 상태에서 목적지를 랜덤하게 덮어쓰지 않음
    if (this.state === 'WANDERING' && this.targetX != null && this.distanceTo({ x: this.targetX, y: this.targetY }) > 20) {
      return
    }

    // [Step 2] 부지 선정 및 신규 건설 계획 (Phased Progression)
    const isScout = ['WARRIOR', 'EXPLORER', 'LEADER'].includes(this.profession)
    const radius = customRadius || (this.village ? this.village.radius * 0.9 : 100)
    
    let tx, ty
    const maxAttempts = 10
    let found = false

    if (this.village && !isScout && world.territory) {
      const vIdx = world.villages ? world.villages.indexOf(this.village) + 1 : 0
      
      for (let i = 0; i < maxAttempts; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * radius
        const candidateX = this.village.x + Math.cos(angle) * dist
        const candidateY = this.village.y + Math.sin(angle) * dist
        
        // 영토 밖으로 배회하는지 최종 검증
        const gX = Math.floor(candidateX / 16), gY = Math.floor(candidateY / 16)
        if (world.territory[gY * 200 + gX] === vIdx) {
          tx = candidateX
          ty = candidateY
          found = true
          break
        }
      }
    }
    
    if (!found) {
      const freeRadius = customRadius || 500
      tx = this.x + (Math.random() - 0.5) * freeRadius
      ty = this.y + (Math.random() - 0.5) * freeRadius
    }
    
    this.targetX = tx
    this.targetY = ty
    this.state = 'WANDERING'
  }

  die(world, reason = '알 수 없는 이유') {
    if (this.isDead) return
    super.die(world)

    // ── 상세 사망 로그 ──────────────────────────────────────────────
    const namePrefix  = this.familyName ? `${this.familyName}씨 ` : ''
    const safeId      = this.id !== undefined ? this.id : '?'
    const hunger      = Math.round(this.needs?.hunger  ?? 0)
    const fatigue     = Math.round(this.needs?.fatigue ?? 0)
    const lvl         = this.level || 1
    const age         = Math.floor(this.age)
    const villageName = this.village?.name || '무소속'

    const logMsg = [
      `[${this.profession}] ${namePrefix}주민 ${safeId}번 사망`,
      `원인: ${reason}`,
      `나이: ${age}세 | Lv.${lvl} | 마을: ${villageName}`,
      `허기: ${hunger}% | 피로: ${fatigue}%`,
    ].join(' / ')

    if (world.broadcastEvent) {
      world.broadcastEvent(logMsg, '#e74c3c')
    }

    if (this.village)  this.village.removeCreature(this)
    if (this.home?.occupants) {
      this.home.occupants = this.home.occupants.filter((o) => o !== this)
    }
    
    // [Optimization] filter 전수조사 대신 swap-and-pop 사용
    const idx = world.creatures.indexOf(this)
    if (idx !== -1) {
      this.isActive = false
      world.creatures[idx] = world.creatures[world.creatures.length - 1]
      world.creatures.pop()
      if (world.creaturePool) world.creaturePool.push(this)
    }
    
    world.spawnResource(this.x, this.y, 'biomass')
  }


  render(ctx, timestamp, world) {
    this.brain.draw(this, ctx, timestamp, world)
  }
}
