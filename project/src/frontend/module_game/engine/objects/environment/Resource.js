import { Entity } from '../../core/Entity.js'

export class Resource extends Entity {
  init(x, y, type) {
    super.init(x, y)
    this.type = type // 'wood', 'biomass', 'food'
    this.size = 6
    this.color = type === 'wood' ? '#d35400' : type === 'food' ? '#2ecc71' : '#f1c40f'
    this.lifeTime = 60000 // 60초 뒤 사라짐 (자연 분해)
  }

  update(deltaTime, world) {
    this.lifeTime -= deltaTime
    if (this.lifeTime <= 0) {
      this.die(world)
    }
  }

  die(world) {
    if (this.isDead) return
    super.die(world)
    world.removeResource(this)
  }

  render(ctx) {
    ctx.fillStyle = '#000'
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2 + 2, this.size, this.size) // shadow
    ctx.fillStyle = this.color
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)
  }
}
