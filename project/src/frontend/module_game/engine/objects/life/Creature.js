import { Entity } from '../../core/Entity.js'
import { JobAssigner } from '../behavior/JobAssigner.js'
import { JobBehaviors } from '../behavior/JobBehaviors.js'
import { CreatureActions } from '../action/CreatureActions.js'
import { CreatureRenders } from '../renders/CreatureRenders.js'
import { CreatureEmotion, DRIVE } from '../emotions/CreatureEmotion.js'
import { SurvivalBehaviors } from '../behavior/SurvivalBehaviors.js'

export class Creature extends Entity {
  init(x, y) {
    super.init(x, y)
    this.size = 16
    this.targetX = x
    this.targetY = y

    // Age and Life stage
    this.age = 0 // In game "years", 1 real second = 1 game year
    this.isAdult = false
    this.energy = 100
    this.maxEnergy = 100
    this.profession = 'NONE' // NONE, GATHERER, LUMBERJACK, FARMER, BUILDER, SCHOLAR, WARRIOR, MINER, LEADER

    this.speed = 1.0 + Math.random() * 0.5
    this.state = 'WANDERING' // WANDERING, GATHERING, HARVESTING, BUILDING, STUDYING, RETURNING, ATTACKING, MINING, TRAINING, RESTING, MATING, FLEEING
    this.target = null
    this.village = null // 所属 마을

    this.currentFrame = 0
    this.frameInterval = 125
    this.lastFrameTime = 0
    this.frameOffsets = [0, -2, -4, -2, 0, 2, 4, 2]

    const colors = ['#e74c3c', '#3498db', '#9b59b6', '#e67e22']
    this.color = colors[Math.floor(Math.random() * colors.length)]

    this.inventory = { wood: 0, biomass: 0, food: 0, stone: 0, iron: 0, gold: 0 }
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

    CreatureEmotion.init(this)
  }

  update(deltaTime, world) {
    if (this.isDead) return
    if (CreatureEmotion.update(this, deltaTime, world)) return

    // [SAB 수정] 애니메이션 프레임 업데이트 로직을 렌더러가 아닌 워커의 update 루프로 이동
    this.lastFrameTime += deltaTime
    if (this.lastFrameTime >= this.frameInterval) {
      this.currentFrame = (this.currentFrame + 1) % 8
      this.lastFrameTime = 0
    }

    // 1초 = 1살 (Age increment)
    this.age += deltaTime / 1000

    // 자연 회복
    if (this.state !== 'ATTACKING' && this.state !== 'FLEEING') {
      this.energy = Math.min(this.maxEnergy, this.energy + deltaTime * 0.002)
    }

    // Grow up and choose a profession (Algorithmic job assignment based on environmental needs)
    if (this.age >= 4 && !this.isAdult) {
      this.isAdult = true
      JobAssigner.assignProfession(this, world)
      this.findHome(world)
    }

    // 집이 없거나 부서진 상태에서 성인일 경우 지속적으로 집 찾기 시도
    if (this.isAdult && !this.home && this.village) {
      this.findHome(world)
    }

    // AI 연산 분산 타이머 (생존 욕구 및 직업 행동 주기적 판단)
    this.aiTickTimer -= deltaTime
    if (this.aiTickTimer <= 0) {
      this.aiTickTimer = 500 + Math.random() * 500

      // 마을 내 식량 자동 섭취 (아사 및 자원 부족 늪 해결)
      if (this.village && this.needs.hunger > 50 && this.village.inventory.food > 0) {
        if (this.distanceTo(this.village) < this.village.radius) {
          this.village.inventory.food--
          CreatureEmotion.fulfillHunger(this)
        }
      }

      // 1. 감정/욕구 평가 모듈 호출하여 충동(DRIVE) 확인
      const survivalDrive = CreatureEmotion.evaluateSurvivalNeeds(this, world)

      if (survivalDrive && survivalDrive.type !== DRIVE.NONE) {
        // 2. 행동(Behavior) 모듈로 위임하여 목표 타겟 및 상태(State) 설정
        const behavior = SurvivalBehaviors[survivalDrive.type]
        if (behavior) behavior(this, survivalDrive.payload, world)
      } else if (this.state === 'WANDERING' || this.state === 'IDLE') {
        // 3. 생존 행동이 발동되지 않았다면 직업 기반 일거리 탐색
        if (this.isAdult && Math.random() < 0.1) this.assignProfession(world)
        this.findWork(world)
      }
    }

    // Death by old age (over 80)
    if (this.age >= 80 && Math.random() < 0.001 * (deltaTime / 16)) {
      this.die(world)
      return
    }

    // 짝짓기 쿨다운 감소
    if (this.matingCooldown > 0) this.matingCooldown -= deltaTime

    // 배변을 통해 대지의 비옥도 회복
    this.poopTimer -= deltaTime
    if (this.poopTimer <= 0) {
      this.poopTimer = 5000 + Math.random() * 10000
      world.addFertility(200) // 배변으로 비옥도 회복
    }

    if (!this.isAdult) {
      // 아기일 때는 배회만 함
      if (Math.random() < 0.02) {
        this.targetX = this.x + (Math.random() - 0.5) * 100
        this.targetY = this.y + (Math.random() - 0.5) * 100
      }
      this.moveToTarget(this.targetX, this.targetY, deltaTime, world)
      return
    }

    // 상태(State) 기반 전략 행동 실행 (Strategy Pattern)
    const action = CreatureActions[this.state]
    if (action) {
      let effectiveDeltaTime = deltaTime
      // 전투나 작업 중일 때 경험치를 획득하고, 레벨에 따른 작업 속도(효율)를 적용합니다.
      if (['GATHERING', 'HARVESTING', 'MINING', 'BUILDING', 'ATTACKING'].includes(this.state)) {
        this.gainExp(deltaTime * 0.05, world)
        effectiveDeltaTime *= this.workEfficiency
      }
      action(this, effectiveDeltaTime, world)
    }
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

      const idx = world.creatures.indexOf(this)
      if (idx !== -1) world.showSpeechBubble(idx, 'creature', `⭐ Lv.${this.level} 달성!`, 3000)
      world.spawnParticle(this.x, this.y, { color: '#f1c40f', count: 15, speed: 60 }) // 레벨업 파티클
    }
  }

  findHome(_world) {
    if (!this.village || this.home) return

    const availableHouses = this.village.buildings.filter(
      (b) => b.type === 'HOUSE' && b.isConstructed && b.occupants.length < b.capacity,
    )

    if (availableHouses.length > 0) {
      // 가장 가까운 집 찾기
      let closestHouse = null
      let minDistance = Infinity
      for (const house of availableHouses) {
        const dist = this.distanceTo(house)
        if (dist < minDistance) {
          minDistance = dist
          closestHouse = house
        }
      }
      if (closestHouse) {
        this.home = closestHouse
        // `occupants`는 Building 객체에 직접 추가/제거
        if (!closestHouse.occupants.includes(this)) closestHouse.occupants.push(this)
      }
    }
  }

  moveToTarget(tx, ty, deltaTime, world) {
    const speedMult = this.age >= 60 ? 0.6 : this.isAdult ? 1.0 : 0.8
    super.moveToTarget(tx, ty, deltaTime, world, speedMult)
  }

  assignProfession(world) {
    JobAssigner.assignProfession(this, world)
  }

  findWork(world) {
    // 4.1 최적화: ChunkManager를 이용해 주변 반경(800x800) 내의 실제 인스턴스 탐색
    const searchRange = { x: this.x - 400, y: this.y - 400, width: 800, height: 800 }
    const candidates = world.chunkManager.query(searchRange)

    const behavior = JobBehaviors[this.profession]
    if (behavior) {
      behavior(this, world, candidates)
    } else {
      this.wander(world)
    }
  }

  wander(world, customRadius = null) {
    const radius = customRadius || (this.village ? this.village.radius : 150)
    if (this.village && Math.random() < 0.8) {
      // 마을 세력권 내부 배회
      this.targetX = this.village.x + (Math.random() - 0.5) * radius * 1.5
      this.targetY = this.village.y + (Math.random() - 0.5) * radius * 1.5
    } else {
      this.targetX = this.x + (Math.random() - 0.5) * 150
      this.targetY = this.y + (Math.random() - 0.5) * 150
    }
    this.state = 'WANDERING'
  }

  die(world) {
    if (this.isDead) return
    super.die(world)
    if (this.village) {
      this.village.removeCreature(this)
    }
    // 사망 시 집에서 퇴거 처리
    if (this.home && this.home.occupants) {
      this.home.occupants = this.home.occupants.filter((o) => o !== this)
    }
    world.creatures = world.creatures.filter((c) => c !== this)
    if (world.creaturePool) world.creaturePool.push(this) // 4.2 최적화: 죽은 개체를 오브젝트 풀에 반납
    world.spawnResource(this.x, this.y, 'biomass')
  }

  render(ctx, timestamp) {
    const renderAction = CreatureRenders[this.state]
    if (renderAction) {
      renderAction(this, ctx, timestamp)
    }
  }
}
