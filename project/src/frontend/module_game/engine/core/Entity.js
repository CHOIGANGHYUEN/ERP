export class Entity {
  constructor(x, y, ...args) {
    this.init(x, y, ...args)
  }

  reset(x, y, ...args) {
    this.init(x, y, ...args)
  }

  init(x, y, ..._args) {
    this.id = Math.random().toString(36).substr(2, 9)
    this.x = x
    this.y = y
    this.isDead = false
    this.size = 10
    this.color = '#ffffff'
  }

  update(_deltaTime, _world) {}
  render(_ctx, _timestamp, ..._args) {}

  die(_world) {
    this.isDead = true
  }

  getBoundingBox() {
    return {
      x: this.x - this.size / 2,
      y: this.y - this.size / 2,
      width: this.size,
      height: this.size
    }
  }

  distanceTo(obj) {
    const dx = obj.x - this.x
    const dy = obj.y - this.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  moveToTarget(tx, ty, deltaTime, world, speedMult = 1.0) {
    const maxX = world.width || (world.canvas ? world.canvas.width : 3200)
    const maxY = world.height || (world.canvas ? world.canvas.height : 3200)
    
    tx = Math.max(0, Math.min(maxX, tx))
    ty = Math.max(0, Math.min(maxY, ty))

    const dx = tx - this.x
    const dy = ty - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 2 && this.speed) {
      this.x += (dx / dist) * this.speed * speedMult * (deltaTime * 0.06)
      this.y += (dy / dist) * this.speed * speedMult * (deltaTime * 0.06)
    }
  }
}
