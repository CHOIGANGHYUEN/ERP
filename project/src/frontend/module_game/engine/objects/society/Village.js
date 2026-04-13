import { Entity } from '../../core/Entity.js'

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

  update(deltaTime, _world) {
    // 4.3 틱 스로틀링: 무거운 마을 레벨 연산은 1초(1000ms) 단위로만 분산 갱신
    this.tickTimer += deltaTime
    if (this.tickTimer >= 1000) {
      this.tickTimer = 0

      // 2. 영토(세력권) 동적 확장 알고리즘: 인구수와 건물 수 비례
      const targetRadius = 200 + this.creatures.length * 15 + this.buildings.length * 25

      // 부드러운 보간(Interpolation)을 통한 세력권 확장 애니메이션 효과
      this.radius += (targetRadius - this.radius) * 0.1
    }
  }

  render(ctx) {
    // 2. 영토 폴리곤(세력권) 영역 반투명 색상 채우기
    ctx.fillStyle = this.nation ? this.nation.color + '33' : 'rgba(255, 255, 255, 0.1)'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = this.nation ? this.nation.color : 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}
