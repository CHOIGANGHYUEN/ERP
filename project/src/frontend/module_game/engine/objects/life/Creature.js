import { Rectangle } from '../../systems/QuadTree.js'
import { Entity } from '../../core/Entity.js'
import { JobAssigner } from '../job/JobAssigner.js'
import { JobBehaviors } from '../job/JobBehaviors.js'
import { CreatureActions } from '../action/CreatureActions.js'
import { CreatureRenders } from '../renders/CreatureRenders.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class Creature extends Entity {
  init(x, y) {
    super.init(x, y)
    this.size = 16
    this.targetX = x
    this.targetY = y

    // Age and Life stage
    this.age = 0 // In game "years", 1 real second = 1 game year
    this.isAdult = false
    this.profession = 'NONE' // NONE, GATHERER, LUMBERJACK, FARMER, BUILDER, SCHOLAR, WARRIOR, MINER, LEADER

    this.speed = 1.0 + Math.random() * 0.5
    this.state = 'WANDERING' // WANDERING, GATHERING, HARVESTING, BUILDING, STUDYING, RETURNING, ATTACKING, MINING
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

    CreatureEmotion.init(this)
  }

  update(deltaTime, world) {
    if (this.isDead) return
    if (CreatureEmotion.update(this, deltaTime, world)) return

    // 1초 = 1살 (Age increment)
    this.age += deltaTime / 1000

    // Grow up and choose a profession (Algorithmic job assignment based on environmental needs)
    if (this.age >= 4 && !this.isAdult) {
      this.isAdult = true
      JobAssigner.assignProfession(this, world)
    }

    // Death by old age (over 80)
    if (this.age >= 80 && Math.random() < 0.001 * (deltaTime / 16)) {
      this.die(world)
      return
    }

    // 번식 (Reproduction) 로직: 성인이고 마을에 잉여 식량이 충분할 때
    if (this.isAdult && this.village && (this.village.inventory.food || 0) >= 10) {
      // 1초당 2% 확률로 아기 생성 (식량 10 소모)
      if (Math.random() < 0.02 * (deltaTime / 1000)) {
        this.village.inventory.food -= 10
        world.spawnCreature(
          this.x + (Math.random() - 0.5) * 30,
          this.y + (Math.random() - 0.5) * 30,
        )
      }
    }

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
      action(this, deltaTime, world)
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
    // 4.1 최적화: QuadTree를 이용해 주변 반경(800x800) 내의 엔티티만 탐색
    const searchRange = new Rectangle(this.x - 400, this.y - 400, 800, 800)
    const candidates = world.quadTree.query(searchRange)

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
