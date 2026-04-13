import { Entity } from '../../core/Entity.js'
import { RenderUtils } from '../../utils/RenderUtils.js'

export class Mine extends Entity {
  init(x, y, type) {
    super.init(x, y)
    // type: 'stone', 'iron', 'gold'
    this.type = type || 'stone'
    this.size = 20
    this.maxEnergy = type === 'gold' ? 500 : type === 'iron' ? 800 : 1500
    this.energy = this.maxEnergy
    
    if (this.type === 'stone') this.color = '#7f8c8d'
    else if (this.type === 'iron') this.color = '#e67e22' // 녹슨 철색
    else if (this.type === 'gold') this.color = '#f1c40f'
  }

  update(deltaTime, world) {
    if (this.isDead) return
    if (this.energy <= 0) {
      this.die(world)
    }
  }

  die(world) {
    if (this.isDead) return
    super.die(world)
    world.mines = world.mines.filter(m => m !== this)
  }

  render(ctx) {
    RenderUtils.drawShadow(ctx, this.x, this.y, this.size, 6)
    
    // 바위 형태 렌더링
    ctx.fillStyle = this.color
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)
  }
}