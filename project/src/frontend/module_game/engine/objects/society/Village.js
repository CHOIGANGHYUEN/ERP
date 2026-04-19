import { Entity } from '../../core/Entity.js'
import { VillageSet } from '../sets/VillageSet.js'

export class Village extends Entity {
  init(x, y, name) {
    super.init(x, y)
    this.name = name
    this.nation = null
    this.inventory = { wood: 100, biomass: 50, food: 50, stone: 0, iron: 0, gold: 0, knowledge: 0 }
    this.creatures = []
    this.buildings = []
    this.availableHouses = [] // [Optimization] 가용 주거지 캐시
    this.radius = 200
    this.tickTimer = 0

    this.brain.init(this)
  }

  get brain() { return VillageSet }

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
    this.brain.update(this, deltaTime, world)
  }

  render(ctx) {
    this.brain.render(this, ctx)
  }
}
