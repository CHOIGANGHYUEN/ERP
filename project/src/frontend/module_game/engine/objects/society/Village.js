import { Entity } from '../../core/Entity.js'
import { Resource } from '../environment/Resource.js'

export class Village extends Entity {
  init(x, y, name) {
    super.init(x, y)
    this.name = name
    this.nation = null // Reference to Nation
    this.inventory = { wood: 100, biomass: 50, food: 50, stone: 0, iron: 0, gold: 0, knowledge: 0 } // 기초 문명 자원 지급
    this.creatures = []
    this.buildings = []
    this.radius = 200 // 기본 영토 크기 (동적 확장됨)
    this.tickTimer = 0 // 4.3 최적화: 틱 스로틀링 타이머
  }

  addCreature(creature) {
    if (!this.creatures.includes(creature)) {
      this.creatures.push(creature)
      creature.village = this
      if (this.nation) creature.color = this.nation.color
    }
  }

  removeCreature(creature) {
    this.creatures = this.creatures.filter((c) => c !== creature)
    creature.village = null
  }

  addBuilding(building) {
    this.buildings.push(building)
    building.village = this
  }

  update(deltaTime, world) {
    // 4.3 틱 스로틀링: 무거운 마을 레벨 연산은 1초(1000ms) 단위로만 분산 갱신
    this.tickTimer += deltaTime
    if (this.tickTimer >= 1000) {
      this.tickTimer = 0

      // 2. 영토(세력권) 동적 확장 알고리즘: 인구수와 건물 수 비례
      const targetRadius = 200 + this.creatures.length * 15 + this.buildings.length * 25

      // 부드러운 보간(Interpolation)을 통한 세력권 확장 애니메이션 효과
      this.radius += (targetRadius - this.radius) * 0.1

      // 3. 패시브 자원 생산 (AI 동선 병목 방지용 보조 수입)
      this.creatures.forEach((c) => {
        if (c.isDead || !c.isAdult) return
        if (c.profession === 'FARMER' || c.profession === 'GATHERER') {
          if (Math.random() < 0.2) this.inventory.food = (this.inventory.food || 0) + 1
        } else if (c.profession === 'LUMBERJACK') {
          if (Math.random() < 0.2) this.inventory.wood = (this.inventory.wood || 0) + 1
        } else if (c.profession === 'MINER') {
          if (Math.random() < 0.1) this.inventory.stone = (this.inventory.stone || 0) + 1
          if (Math.random() < 0.05) this.inventory.iron = (this.inventory.iron || 0) + 1
        } else if (c.profession === 'SCHOLAR') {
          if (Math.random() < 0.1) this.inventory.knowledge = (this.inventory.knowledge || 0) + 1
        }
      })

      // 4. 영토 내 떨어진 자원(Resource) 자동 수집 로직
      const range = {
        x: this.x - this.radius,
        y: this.y - this.radius,
        width: this.radius * 2,
        height: this.radius * 2,
      }
      const nearbyItems = world.chunkManager.query(range)
      nearbyItems.forEach((item) => {
        if (item instanceof Resource && !item.isDead && this.distanceTo(item) < this.radius) {
          this.inventory[item.type] = (this.inventory[item.type] || 0) + 1
          // 고기, 우유, 바이오매스 등은 식량으로도 환산하여 굶주림 방지
          if (['meat', 'milk', 'biomass'].includes(item.type)) {
            this.inventory.food = (this.inventory.food || 0) + 1
          }
          item.die(world)
        }
      })
    }
  }

  render(ctx) {
    // 타일 기반 영토 렌더링
    ctx.fillStyle = this.nation ? this.nation.color + '33' : 'rgba(255, 255, 255, 0.1)'

    const gridSize = 32
    const startX = Math.floor((this.x - this.radius) / gridSize) * gridSize
    const endX = Math.ceil((this.x + this.radius) / gridSize) * gridSize
    const startY = Math.floor((this.y - this.radius) / gridSize) * gridSize
    const endY = Math.ceil((this.y + this.radius) / gridSize) * gridSize

    for (let tx = startX; tx < endX; tx += gridSize) {
      for (let ty = startY; ty < endY; ty += gridSize) {
        const tileCenterX = tx + gridSize / 2
        const tileCenterY = ty + gridSize / 2
        const dist = Math.sqrt(
          Math.pow(tileCenterX - this.x, 2) + Math.pow(tileCenterY - this.y, 2),
        )
        if (dist < this.radius) {
          ctx.fillRect(tx, ty, gridSize, gridSize)
        }
      }
    }
  }
}
