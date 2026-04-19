import { MoveTask } from '../../tasks/MoveTask.js'
import { BuildTask } from '../../tasks/BuildTask.js'
import { findPath } from '../../../systems/PathSystem.js'

export const BUILDER = (creature, world, _candidates) => {
  // 0. 기초 검증
  if (!creature.village) {
    console.warn(`[BUILDER_DEBUG] ${creature.id}: 소속 마을이 없어 배회합니다.`)
    return creature.wander(world)
  }

  // 1. 기존에 짓고 있는 건물이 있는지 확인
  let targetBuilding = creature.village.buildings.find((b) => !b.isConstructed && !b.isUnreachable)

  if (!targetBuilding) {
    const inv = creature.village.inventory
    const wood = inv.wood || 0

    console.log(
      `[BUILDER_DEBUG] ${creature.id}: 기존 건설 대상 없음. 신규 스폰 체크 (Wood: ${wood})`,
    )

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

      console.log(
        `[BUILDER_DEBUG] 1. 신규 스폰 결정: ${type} (예상비용 W:${costWood}, S:${costStone})`,
      )

      let attempts = 0
      let success = false
      let spawnX, spawnY

      while (attempts < 3) {
        attempts++
        spawnX = creature.village.x + (Math.random() - 0.5) * 180
        spawnY = creature.village.y + (Math.random() - 0.5) * 180

        // 지형 체크 로그
        let validTerrain = true
        if (world.terrain) {
          const cols = Math.ceil(world.width / 16)
          const tx = Math.floor(spawnX / 16)
          const ty = Math.floor(spawnY / 16)
          const terrainType = world.terrain[ty * cols + tx]

          if (terrainType === 2 || terrainType >= 3) {
            console.log(
              `[BUILDER_DEBUG] 시도 ${attempts}: 지형 부적합 (Type: ${terrainType}) @ [${Math.floor(spawnX)}, ${Math.floor(spawnY)}]`,
            )
            validTerrain = false
          }
        }

        if (validTerrain) {
          const path = findPath(world, creature, { x: spawnX, y: spawnY })
          if (path !== null) {
            console.log(`[BUILDER_DEBUG] 시도 ${attempts}: 경로 확보 성공!`)
            success = true
            break
          } else {
            console.log(`[BUILDER_DEBUG] 시도 ${attempts}: 경로를 찾을 수 없음.`)
          }
        }
      }

      if (success) {
        console.log(
          `[BUILDER_DEBUG] 2. 건물 스폰 확정: ${type} at [${Math.floor(spawnX)}, ${Math.floor(spawnY)}]`,
        )
        if (costWood) inv.wood -= costWood
        if (costStone) inv.stone -= costStone
        if (costGold) inv.gold -= costGold
        world.spawnBuilding(spawnX, spawnY, type, creature.village)
      } else {
        console.warn(`[BUILDER_DEBUG] 2-1. 3회 시도 모두 실패 (배회 상태로 전환)`)
        creature.wander(world)
      }
      return
    } else {
      // 자원이 부족하거나 확률(0.2)에 걸리지 않은 경우
      if (wood < 30) console.log(`[BUILDER_DEBUG] 자원 부족으로 신규 건설 스킵 (Wood: ${wood})`)
      creature.wander(world)
    }
  } else {
    // 2. 기존 미완공 건물이 있는 경우
    console.log(
      `[BUILDER_DEBUG] 1. 기존 건설 프로세스 진입: 건물이름 ${targetBuilding.type}(ID:${targetBuilding.id})`,
    )

    const path = findPath(world, creature, targetBuilding)
    console.log(`[BUILDER_DEBUG] 2. 길찾기 결과: ${path ? '성공' : '실패'}`)

    if (path !== null) {
      if (creature.taskQueue.length === 0) {
        creature.taskQueue.push(new MoveTask(targetBuilding))
        creature.taskQueue.push(new BuildTask(targetBuilding))
        console.log(`[BUILDER_DEBUG] 3. 태스크 부여 완료 (Move & Build)`)
      } else {
        console.log(
          `[BUILDER_DEBUG] 3-1. 이미 태스크가 존재함 (Queue Length: ${creature.taskQueue.length})`,
        )
      }
    } else {
      console.error(`[BUILDER_DEBUG] 2-1. 기존 건물 도달 불가! 도달불능 마킹 후 배회.`)
      targetBuilding.isUnreachable = true
      creature.wander(world)
    }
  }
}
