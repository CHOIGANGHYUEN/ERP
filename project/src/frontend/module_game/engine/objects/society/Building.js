import { Entity } from '../../core/Entity.js'
import { BuildingSet } from '../sets/BuildingSet.js'

export class Building extends Entity {
  init(x, y, type) {
    super.init(x, y)
    this.type = type // 'HOUSE', 'SCHOOL', 'FARM', 'BARRACKS', 'TEMPLE', 'SMITHY', 'MARKET', 'FENCE', 'FENCE_GATE'
    this.tier = 1
    this.maxTier = ['HOUSE', 'FARM'].includes(type) ? 3 : 2

    const typeProps = {
      HOUSE: { size: 24, color: '#e74c3c', maxProgress: 100 },
      SCHOOL: { size: 32, color: '#3498db', maxProgress: 200 },
      FARM: { size: 36, color: '#27ae60', maxProgress: 120 },
      BARRACKS: { size: 32, color: '#7f8c8d', maxProgress: 250 },
      TEMPLE: { size: 40, color: '#f1c40f', maxProgress: 400 },
      SMITHY: { size: 28, color: '#34495e', maxProgress: 150 },
      MARKET: { size: 38, color: '#f39c12', maxProgress: 180 },
      FENCE: { size: 16, color: '#95a5a6', maxProgress: 20 },
      FENCE_GATE: { size: 16, color: '#d35400', maxProgress: 20 },
    }

    const props = typeProps[type] || { size: 24, color: '#e74c3c', maxProgress: 100 }
    this.size = props.size
    this.color = props.color
    this.maxProgress = props.maxProgress
    
    this.isConstructed = false
    this.progress = 0
    this.upgradeTimer = 0
    this.effectTimer = 0

    if (this.type === 'FENCE_GATE') {
      this.isLocked = true
    }

    if (this.type === 'HOUSE') {
      this.capacity = 2 * this.tier
      this.occupants = []
    }

    this.brain.init(this)
  }

  get brain() { return BuildingSet }

  update(deltaTime, world) {
    this.brain.update(this, deltaTime, world)
  }

  render(ctx, world) {
    this.brain.render(this, ctx, world)
  }
}
