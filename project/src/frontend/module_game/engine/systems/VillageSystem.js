import { MarketSystem } from '../systems/MarketSystem.js'
import { Village } from '../objects/society/Village.js'
import { Nation } from '../objects/society/Nation.js'
import { JobAssigner } from '../objects/action/JobAssigner.js'

export class VillageSystem {
  constructor() {
    this.marketSystem = new MarketSystem()
  }

  /**
   * 🏘️ [초대 촌장 임명 시스템]
   * 새로운 마을을 생성하고 창립자(founder)를 초대 촌장으로 임명합니다.
   */
  createVillage(world, x, y, founder) {
    const villageName = `마을 ${world.villages.length + 1}`
    const newVillage = new Village(x, y, villageName)
    
    // 1. 초대 촌장 ID 기록
    if (founder) {
      newVillage.leaderId = founder.id
    }

    world.villages.push(newVillage)

    // 2. 창립자를 마을 주민으로 추가 및 직업 강제 부여
    if (founder) {
      newVillage.addCreature(founder)
      // 조건(나이 등)을 무시하고 즉시 'LEADER' 직업 부여
      JobAssigner.changeProfession(founder, 'LEADER', false, true)
    }

    // 3. 국가(Nation) 할당 로직
    this._assignToNation(world, newVillage)

    console.log(`👑 [VillageSystem] ${villageName} 생성 및 초대 촌장(ID: ${founder?.id}) 임명 완료.`)
    return newVillage
  }

  /**
   * 마을을 가장 가까운 국가에 소속시키거나 새로운 국가를 창건합니다.
   */
  _assignToNation(world, village) {
    let assignedNation = null
    const x = village.x, y = village.y

    for (const nation of world.nations) {
      if (nation.villages.length === 0) continue

      const closestVillageDist = nation.villages.reduce((minDist, v) => {
        const dx = v.x - x
        const dy = v.y - y
        const dist = Math.sqrt(dx * dx + dy * dy)
        return dist < minDist ? dist : minDist
      }, Infinity)

      if (closestVillageDist < 500) {
        assignedNation = nation
        break
      }
    }

    if (assignedNation) {
      assignedNation.addVillage(village)
    } else {
      const nationColors = ['#9b59b6', '#3498db', '#e74c3c', '#2ecc71', '#f1c40f']
      const newNation = new Nation(
        `왕국 ${world.nations.length + 1}`,
        nationColors[world.nations.length % nationColors.length],
      )
      world.nations.push(newNation)
      newNation.addVillage(village)
      world.broadcastEvent(
        `새로운 국가 [${newNation.name}]이(가) 건국되었습니다!`,
        newNation.color,
      )
    }
  }

  update(deltaTime, world) {
    // 1. 시장 시스템 (글로벌 교역) 업데이트
    this.marketSystem.update(deltaTime, world)

    // 2. 각 마을 업데이트 (뇌 위임)
    world.villages.forEach((v) => {
      v.update(deltaTime, world)
    })
  }
}
