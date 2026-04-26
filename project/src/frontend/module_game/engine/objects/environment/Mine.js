import { Entity } from '../../core/Entity.js'
import { RenderUtils } from '../../utils/RenderUtils.js'

export class Mine extends Entity {
  init(x, y, type) {
    super.init(x, y)
    this.type = type || 'stone'
    this.size = 20

    const MINE_PROPS = {
      stone: { color: '#7f8c8d', energy: 2000 },
      coal: { color: '#2c3e50', energy: 1500 },
      copper: { color: '#d35400', energy: 1800 },
      iron: { color: '#e67e22', energy: 1500 },
      silver: { color: '#bdc3c7', energy: 1200 },
      gold: { color: '#f1c40f', energy: 1000 },
      diamond: { color: '#00cec9', energy: 3000 },
      ruby: { color: '#e74c3c', energy: 2500 },
      emerald: { color: '#2ecc71', energy: 2500 },
      sapphire: { color: '#0984e3', energy: 2500 },
      uranium: { color: '#00b894', energy: 5000 },
    }
    const props = MINE_PROPS[this.type] || MINE_PROPS.stone
    this.color = props.color
    this.maxEnergy = props.energy
    this.energy = this.maxEnergy
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
    world.mines = world.mines.filter((m) => m !== this)

    // 광물이 완전히 파괴되면 보너스 조각 1개를 드랍합니다.
    world.spawnResource(
      this.x + (Math.random() - 0.5) * 20,
      this.y + (Math.random() - 0.5) * 20,
      this.type,
    )
  }

  render(ctx) {
    RenderUtils.drawShadow(ctx, this.x, this.y, this.size, 6)

    // 바위 형태 렌더링
    ctx.fillStyle = this.color
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)
  }
}
