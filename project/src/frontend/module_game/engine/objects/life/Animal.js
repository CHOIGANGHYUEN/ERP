import { Entity } from '../../core/Entity.js'
import { AnimalSet } from '../sets/AnimalSet.js'
export class Animal extends Entity {
  init(x, y, type) {
    super.init(x, y)
    this.type = type // 'HERBIVORE' or 'CARNIVORE'
    this.targetX = x
    this.targetY = y
    this.speed = type === 'CARNIVORE' ? 2.0 : 1.5
    this.state = 'WANDERING'
    this.target = null
    this.energy = 100
    this.age = 0
    this.baseSize = type === 'CARNIVORE' ? 14 : 10
    this.size = this.baseSize * 0.5 // 어릴 때는 작게 시작

    this.currentFrame = 0
    this.frameInterval = 100
    this.lastFrameTime = 0
    this.frameOffsets = [0, -2, -4, -2, 0] // 5프레임 사이클

    this.color = type === 'CARNIVORE' ? '#e67e22' : '#ecf0f1'
    this.resourceTimer = 0

    this.resourceTimer = 0

    this.brain.init(this)
  }

  get brain() { return AnimalSet }

  update(deltaTime, world) {
    if (this.isDead) return

    // [SAB 수정] 애니메이션 프레임 업데이트 로직
    this.lastFrameTime += deltaTime
    if (this.lastFrameTime >= this.frameInterval) {
      this.currentFrame = (this.currentFrame + 1) % 5
      this.lastFrameTime = 0
    }

    if (this.energy <= 0) {
      this.die(world)
      return
    }

    // 수명 시스템 제거 및 고정 크기 적용
    this.size = this.baseSize || (this.type === 'CARNIVORE' ? 14 : 10)
    const growthRatio = 1.0

    // 가축화 보상(자원 생성 & 감성적 효과)
    if (this.type === 'HERBIVORE') {
      this.resourceTimer += deltaTime
      if (this.resourceTimer > 10000) { // 10초 주기
        this.resourceTimer = 0
        // 주민이 근처에 있다면 주민의 피로/허기를 조금 줄여주거나 자원을 드랍
        const nearbyCreatures = world.creatures.filter(c => !c.isDead && c.distanceTo(this) < 100)
        let hasFarmer = false
        for (const c of nearbyCreatures) {
           // 근처 주민 감성 증가 (피로 감소, 동물 구경)
           c.needsFatigue = Math.max(0, c.needsFatigue - 5)
           if (c.profession === 'FARMER') hasFarmer = true
        }
        
        // 농부가 곁에 있거나 어른(크기>=1)으로 다 자랐으면 우유나 고기 자원 약간 생성
        if (hasFarmer && growthRatio >= 0.8) {
           world.spawnResource(
              this.x + (Math.random() - 0.5) * 20,
              this.y + (Math.random() - 0.5) * 20,
              Math.random() > 0.5 ? 'milk' : 'meat'
           )
        }
      }
    }

    // 동물의 두뇌 AI 및 상태 전략 모두 Set에 위임
    this.brain.update(this, deltaTime, world)
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
    
    // 사냥 보상으로 식량 대량 드랍 (육식 5개, 초식 3개)
    const dropAmount = this.type === 'CARNIVORE' ? 5 : 3
    for (let i = 0; i < dropAmount; i++) {
      world.spawnResource(
        this.x + (Math.random() - 0.5) * 30,
        this.y + (Math.random() - 0.5) * 30,
        'food'
      )
    }
  }

  render(ctx, timestamp, world) {
    this.brain.draw(this, ctx, timestamp, world)
  }
}
