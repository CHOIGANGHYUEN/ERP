import { Entity } from '../../core/Entity.js'

export class Tornado extends Entity {
  init(x, y) {
    super.init(x, y)
    this.size = 40
    this.lifeTime = 15000 // 15초 유지
    this.speed = 1.5
    this.targetX = x + (Math.random() - 0.5) * 500
    this.targetY = y + (Math.random() - 0.5) * 500
    this.angle = 0
  }

  update(deltaTime, world) {
    if (this.isDead) return
    this.lifeTime -= deltaTime
    this.angle += deltaTime * 0.01

    if (this.lifeTime <= 0) {
      this.die(world)
      return
    }

    // 무작위 이동
    if (Math.random() < 0.05) {
      this.targetX = this.x + (Math.random() - 0.5) * 300
      this.targetY = this.y + (Math.random() - 0.5) * 300
    }
    this.moveToTarget(this.targetX, this.targetY, deltaTime, world, 1.5)

    // 주변 휩쓸기 데미지 (QuadTree 쿼리)
    const range = {
      x: this.x - this.size,
      y: this.y - this.size,
      width: this.size * 2,
      height: this.size * 2,
    }
    const victims = world.quadTree.query(range)
    for (let v of victims) {
      if (v !== this && this.distanceTo(v) < this.size) {
        if (v.energy !== undefined) v.energy -= deltaTime * 0.1
        else if (v.progress !== undefined) v.progress -= deltaTime * 0.05 // 건물 피해
      }
    }
  }

  die(world) {
    if (this.isDead) return
    super.die(world)
    world.tornadoes = world.tornadoes.filter((t) => t !== this)
  }

  render(ctx) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle)
    ctx.fillStyle = 'rgba(149, 165, 166, 0.6)'
    ctx.beginPath()
    ctx.ellipse(0, -this.size / 2, this.size, this.size / 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, 0, this.size * 0.6, this.size / 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
