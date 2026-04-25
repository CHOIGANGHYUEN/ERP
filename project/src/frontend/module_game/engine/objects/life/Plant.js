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
    this.maxAge = type === 'tree' ? 10000 + Math.random() * 5000 : 3000 + Math.random() * 2000
    this.color = type === 'tree' ? '#1e8449' : type === 'crop' ? '#f7b731' : '#26de81'
    this.energy = type === 'tree' ? 200 : type === 'crop' ? 20 : 50
    this.isImmortal = type === 'tree' // 💡 [구조 개편] 나무는 시간에 따라 늙어 죽지 않음

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

    // 💡 [구조 개편] 식물이 제거될 때 비옥도 반환 및 자원 드랍
    let amount = 0
    let resourceType = 'biomass'
    let fertilityRefund = 1

    if (this.type === 'tree') {
      amount = 5 + Math.floor(Math.random() * 3) // 5+ 자원 반환
      resourceType = 'wood'
      fertilityRefund = 10 // 나무 비옥도 환불
    } else if (this.type === 'crop') {
      amount = 2 + (this.size >= this.maxSize * 0.8 ? 2 : 0) // 기본 2+, 다 자랐으면 추가
      resourceType = 'food'
      fertilityRefund = 1 // 농작물 비옥도 환불
    } else if (this.type === 'grass') {
      amount = 0 // 풀은 아무런 자원을 남기지 않음
      fertilityRefund = 1 // 풀 비옥도 환불
    }

    // 비옥도 환급
    if (world.addFertility) {
       world.addFertility(fertilityRefund)
    }

    // 자원 드랍
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
