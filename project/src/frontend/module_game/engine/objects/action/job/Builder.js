import { MoveTask } from '../../tasks/MoveTask.js'
import { BuildTask } from '../../tasks/BuildTask.js'
import { findPath } from '../../../systems/PathSystem.js'
import { JobAssigner } from '../JobAssigner.js'

export const BUILDER = (creature, world, _candidates) => {
  // 0. 기초 검증
  if (!creature.village) {
    return creature.wander(world)
  }

  // 1. 기존에 짓고 있는 건물이 있는지 확인
  let targetBuilding = creature.village.buildings.find((b) => !b.isConstructed && !b.isUnreachable)

  if (!targetBuilding) {
    const inv = creature.village.inventory
    const wood = inv.wood || 0

    // 신규 건설 로직 진입 조건 체크
    if (wood >= 30 && Math.random() < 0.2) {
      let type = 'HOUSE'
      const bList = creature.village.buildings
      let costWood = 0,
        costStone = 0,
        costGold = 0

      // 우선순위에 따른 타입 결정 로직 로그
      if (!bList.some((b) => b.type === 'FARM') && wood >= 40) {
        type = 'FARM'
        costWood = 40
      } else if (
        bList.filter((b) => b.type === 'HOUSE').length < creature.village.creatures.length / 3 &&
        wood >= 30
      ) {
        type = 'HOUSE'
        costWood = 30
      } else if (!bList.some((b) => b.type === 'BARRACKS') && wood >= 50 && inv.stone >= 20) {
        type = 'BARRACKS'
        costWood = 50
        costStone = 20
      } else if (!bList.some((b) => b.type === 'SMITHY') && wood >= 40 && inv.stone >= 30) {
        type = 'SMITHY'
        costWood = 40
        costStone = 30
      } else if (!bList.some((b) => b.type === 'SCHOOL') && wood >= 60) {
        type = 'SCHOOL'
        costWood = 60
      } else if (
        !bList.some((b) => b.type === 'TEMPLE') &&
        wood >= 100 &&
        inv.stone >= 50 &&
        inv.gold >= 10
      ) {
        type = 'TEMPLE'
        costWood = 100
        costStone = 50
        costGold = 10
      } else if (wood >= 30) {
        type = 'HOUSE'
        costWood = 30
      }

      let attempts = 0
      let success = false
      let spawnX, spawnY

      while (attempts < 3) {
        attempts++
        spawnX = creature.village.x + (Math.random() - 0.5) * 180
        spawnY = creature.village.y + (Math.random() - 0.5) * 180

        let validTerrain = true
        if (world.terrain) {
          const cols = Math.ceil(world.width / 16)
          const tx = Math.floor(spawnX / 16)
          const ty = Math.floor(spawnY / 16)
          const terrainType = world.terrain[ty * cols + tx]

          if (terrainType === 2 || terrainType >= 3) {
            validTerrain = false
          }
        }

        if (validTerrain) {
          const path = findPath(world, creature, { x: spawnX, y: spawnY })
          if (path !== null) {
            success = true
            break
          }
        }
      }

      if (success) {
        if (costWood) inv.wood -= costWood
        if (costStone) inv.stone -= costStone
        if (costGold) inv.gold -= costGold
        world.spawnBuilding(spawnX, spawnY, type, creature.village)
      } else {
        creature.wander(world)
      }
      return
    } else {
      // 자원이 부족하거나 확률(0.2)에 걸리지 않은 경우
      if (wood < 30) {
        JobAssigner.changeProfession(creature, 'LUMBERJACK', true) // 임시 전직

        const idx = world.creatures.indexOf(creature)
        if (idx !== -1) world.showSpeechBubble(idx, 'creature', '🪓나무 구하러 함!', 2000)
        return
      }
      creature.wander(world)
    }
  } else {
    // 2. 기존 미완공 건물이 있는 경우
    const path = findPath(world, creature, targetBuilding)

    if (path !== null) {
      if (creature.taskQueue.length === 0) {
        creature.taskQueue.push(new MoveTask(targetBuilding))
        creature.taskQueue.push(new BuildTask(targetBuilding))
      }
    } else {
      targetBuilding.isUnreachable = true
      creature.wander(world)
    }
  }
}
