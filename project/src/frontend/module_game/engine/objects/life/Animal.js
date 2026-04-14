import { Entity } from '../../core/Entity.js'
import { AnimalActions } from '../action/AnimalActions.js'
import { AnimalRenders } from '../renders/AnimalRenders.js'
import { AnimalEmotion } from '../emotions/AnimalEmotion.js'
import { AnimalBehaviors } from '../behavior/AnimalBehaviors.js'

export class Animal extends Entity {
  init(x, y, type) {
    super.init(x, y)
    this.type = type // 'HERBIVORE' (e.g. Rabbit) or 'CARNIVORE' (e.g. Tiger)
    this.size = type === 'CARNIVORE' ? 14 : 10
    this.targetX = x
    this.targetY = y
    this.speed = type === 'CARNIVORE' ? 2.0 : 1.5
    this.state = 'WANDERING' // WANDERING, HUNTING, EATING
    this.target = null
    this.energy = 100

    this.currentFrame = 0
    this.frameInterval = 100
    this.lastFrameTime = 0
    this.frameOffsets = [0, -2, -4, -2, 0, 2, 4, 2]

    this.color = type === 'CARNIVORE' ? '#e67e22' : '#ecf0f1' // Orange for carnivore, white for herbivore

    AnimalEmotion.init(this)
  }

  update(deltaTime, world) {
    if (this.isDead) return
    AnimalEmotion.update(this, deltaTime)

    // [SAB 수정] 애니메이션 프레임 업데이트 로직을 렌더러가 아닌 워커의 update 루프로 이동
    this.lastFrameTime += deltaTime
    if (this.lastFrameTime >= this.frameInterval) {
      this.currentFrame = (this.currentFrame + 1) % 8
      this.lastFrameTime = 0
    }

    if (this.energy <= 0) {
      this.die(world)
      return
    }

    // 동물의 두뇌 AI (0.5초마다 판단)
    this.aiTickTimer = (this.aiTickTimer || 0) - deltaTime
    if (this.aiTickTimer <= 0) {
      this.aiTickTimer = 500 + Math.random() * 500
      const searchRange = { x: this.x - 200, y: this.y - 200, width: 400, height: 400 }
      const candidates = world.chunkManager.query(searchRange)

      const drive = AnimalEmotion.evaluateSurvivalNeeds(this, candidates)
      if (drive) {
        const behavior = AnimalBehaviors[drive.action]
        if (behavior) behavior(this, drive.target, world)
      } else if (this.state === 'WANDERING' || this.state === 'IDLE') {
        if (Math.random() < 0.05) this.wander(world)
      }
    }

    // 상태(State) 기반 전략 행동 실행 (Strategy Pattern)
    const action = AnimalActions[this.state]
    if (action) {
      action(this, deltaTime, world)
    }
  }

  wander(_world) {
    this.targetX = this.x + (Math.random() - 0.5) * 200
    this.targetY = this.y + (Math.random() - 0.5) * 200
    this.state = 'WANDERING'
  }

  die(world) {
    if (this.isDead) return
    super.die(world)
    world.animals = world.animals.filter((a) => a !== this)
    if (world.animalPool) world.animalPool.push(this) // 4.2 최적화: 죽은 동물을 풀에 반납
    world.spawnResource(this.x, this.y, 'biomass')
  }

  render(ctx, timestamp) {
    const renderAction = AnimalRenders[this.state]
    if (renderAction) {
      renderAction(this, ctx, timestamp)
    }
  }
}
