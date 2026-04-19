import { Entity } from '../../core/Entity.js'
import { VillageSet } from '../sets/VillageSet.js'

export class Village extends Entity {
  init(x, y, name) {
    console.log(`🏠 [Village] init 시작: ${name}`);
    super.init(x, y)
    this.name = name
    this.nation = null
    this.inventory = { wood: 100, biomass: 50, food: 50, stone: 0, iron: 0, gold: 0, knowledge: 0 }
    this.creatures = []
    this.buildings = []
    this.availableHouses = [] // [Optimization] 가용 주거지 캐시
    
    // Census: [Optimization] 실시간 통계 캐싱 (JobAssigner 등에서 O(1) 조회를 위해 사용)
    this.professionCounts = { NONE: 0, GATHERER: 0, LUMBERJACK: 0, FARMER: 0, BUILDER: 0, SCHOLAR: 0, WARRIOR: 0, MINER: 0, LEADER: 0, MERCHANT: 0 }
    this.buildingCounts = { total: 0, constructed: 0, unconstructed: 0 }

    this.radius = 200
    this.tickTimer = 0

    this.brain.init(this)
    console.log(`✅ [Village] init 완료: ${this.name}`);
  }

  get brain() { return VillageSet }

  addCreature(creature) {
    if (!this.creatures.includes(creature)) {
      this.creatures.push(creature)
      creature.village = this
      this.professionCounts[creature.profession || 'NONE']++
      if (this.nation) creature.color = this.nation.color
    }
  }

  removeCreature(creature) {
    const idx = this.creatures.indexOf(creature)
    if (idx !== -1) {
      if (this.professionCounts[creature.profession]) {
        this.professionCounts[creature.profession]--
      }
      this.creatures[idx] = this.creatures[this.creatures.length - 1]
      this.creatures.pop()
    }
    creature.village = null
  }

  updateProfessionCount(oldJob, newJob) {
    if (this.professionCounts[oldJob] !== undefined) this.professionCounts[oldJob]--
    if (this.professionCounts[newJob] !== undefined) this.professionCounts[newJob]++
  }

  addBuilding(building) {
    this.buildings.push(building)
    building.village = this
    this.buildingCounts.total++
    if (building.isConstructed) this.buildingCounts.constructed++
    else this.buildingCounts.unconstructed++
  }

  updateBuildingStatus(built) {
    if (built) {
      this.buildingCounts.unconstructed--
      this.buildingCounts.constructed++
    }
  }

  update(deltaTime, world) {
    this.brain.update(this, deltaTime, world)
  }

  render(ctx) {
    this.brain.render(this, ctx)
  }
}
