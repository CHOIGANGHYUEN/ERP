import { Entity } from '../../core/Entity.js'
import { PlantSet } from '../sets/PlantSet.js'

export class Plant extends Entity {
  get brain() { return PlantSet }

  init(x, y, type) {
    super.init(x, y)
    this.type = type // 'grass', 'tree', 'crop'
    this.state = 'GROWING' // 기본 상태 지정
    this.age = 0
    this.size = type === 'tree' ? 30 : type === 'crop' ? 15 : 10
    this.maxSize = this.size
    this.color = type === 'tree' ? '#27ae60' : type === 'crop' ? '#f1c40f' : '#2ecc71'
    this.energy = type === 'tree' ? 200 : type === 'crop' ? 20 : 50
    this.isImmortal = type === 'tree' && Math.random() < 0.3

    this.brain.init(this)
  }

  update(deltaTime, world) {
    if (this.isDead) return
    this.brain.update(this, deltaTime, world)
  }

  die(world) {
    if (this.isDead) return
    super.die(world)
    world.removePlant(this)
    // 자연 소멸 또는 외부 요인 제거 시 자원 드랍
    let amount = 1
    let resourceType = 'biomass'

    if (this.type === 'tree') {
      amount = 3 + Math.floor(Math.random() * 3)
      resourceType = 'wood'
    } else if (this.type === 'crop') {
      // 수확 시 농작물은 식량을 대량 생산
      amount = this.size >= this.maxSize * 0.8 ? 10 : 2
      resourceType = 'food'
    }

    for (let i = 0; i < amount; i++) {
      world.spawnResource(
        this.x + (Math.random() - 0.5) * 30,
        this.y + (Math.random() - 0.5) * 30,
        resourceType,
      )
    }
  }

  render(ctx, timestamp, windSpeed) {
    this.brain.draw(this, ctx, timestamp, windSpeed)
  }
}
