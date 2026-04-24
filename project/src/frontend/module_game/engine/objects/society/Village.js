import { Entity } from '../../core/Entity.js'
import { VillageSet } from '../sets/VillageSet.js'

export class Village extends Entity {
  init(x, y, name) {
    console.group(`🏘️ [Village: ${name}] 초기화 시작`)
    super.init(x, y)
    this.name = name
    this.nation = null
    this.inventory = {
      wood: 500,
      biomass: 200,
      food: 300,
      stone: 200,
      iron: 100,
      gold: 50,
      knowledge: 0,
    }
    this.creatures = []
    this.buildings = []
    this.availableHouses = [] // [Optimization] 가용 주거지 캐시

    // Census: [Optimization] 실시간 통계 캐싱
    this.professionCounts = {
      NONE: 0,
      GATHERER: 0,
      LUMBERJACK: 0,
      FARMER: 0,
      BUILDER: 0,
      SCHOLAR: 0,
      WARRIOR: 0,
      MINER: 0,
      LEADER: 0,
      MERCHANT: 0,
    }
    this.buildingCounts = { total: 0, constructed: 0, unconstructed: 0 }

    this.radius = 200
    // [Staggering] 마을마다 업데이트 시점을 프레임별로 분산하여 성능 스파이크를 방지합니다.
    this.tickTimer = Math.random() * 1000

    this.brain.init(this)
    console.log(`📊 초기 인벤토리:`, { ...this.inventory })
    console.log(`📍 위치: (${x.toFixed(1)}, ${y.toFixed(1)})`)
    console.groupEnd()
    console.log(`✅ [Village] ${this.name} 생성 완료`)
  }

  get brain() {
    return VillageSet
  }

  addCreature(creature) {
    if (!this.creatures.includes(creature)) {
      this.creatures.push(creature)
      creature.village = this

      const job = creature.profession || 'NONE'
      this.professionCounts[job]++

      if (this.nation) {
        creature.color = this.nation.color
      }

      console.log(`👤 [Village: ${this.name}] 새로운 주민 합류!`, {
        totalPop: this.creatures.length,
        job: job,
        nationColor: this.nation ? '적용됨' : '없음',
      })
    }
  }

  removeCreature(creature) {
    const idx = this.creatures.indexOf(creature)
    if (idx !== -1) {
      const job = creature.profession || 'NONE'
      if (this.professionCounts[job]) {
        this.professionCounts[job]--
      }

      this.creatures[idx] = this.creatures[this.creatures.length - 1]
      this.creatures.pop()

      console.log(`🏃 [Village: ${this.name}] 주민 이탈/사망.`, {
        remainingPop: this.creatures.length,
        removedJob: job,
      })
    }
    creature.village = null
  }

  updateProfessionCount(oldJob, newJob) {
    if (this.professionCounts[oldJob] !== undefined) this.professionCounts[oldJob]--
    if (this.professionCounts[newJob] !== undefined) this.professionCounts[newJob]++

    console.log(
      `📈 [Village: ${this.name}] 직업 통계 갱신: ${oldJob} ➔ ${newJob}`,
      ` (현재 ${newJob}: ${this.professionCounts[newJob]}명)`,
    )
  }

  addBuilding(building) {
    this.buildings.push(building)
    building.village = this
    this.buildingCounts.total++

    if (building.isConstructed) {
      this.buildingCounts.constructed++
    } else {
      this.buildingCounts.unconstructed++
    }

    console.log(`🏗️ [Village: ${this.name}] 새 건물 부지 추가: ${building.type}`, {
      isConstructed: building.isConstructed,
      totalBuildings: this.buildingCounts.total,
    })
  }

  updateBuildingStatus(built) {
    if (built) {
      this.buildingCounts.unconstructed--
      this.buildingCounts.constructed++
      console.log(`🔨 [Village: ${this.name}] 건물 건설 완료!`, {
        constructed: this.buildingCounts.constructed,
        pending: this.buildingCounts.unconstructed,
      })
    }
  }

  update(deltaTime, world) {
    // update는 매 프레임 실행되므로 로그를 남기면 성능이 저하될 수 있습니다.
    // 필요 시 특정 조건(예: 100프레임마다)에서만 남기도록 설정하는 것이 좋습니다.
    this.brain.update(this, deltaTime, world)
  }

  render(ctx) {
    this.brain.render(this, ctx)
  }
}
