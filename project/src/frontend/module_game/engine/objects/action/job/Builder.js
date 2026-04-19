import { MoveTask } from '../../tasks/MoveTask.js'
import { BuildTask } from '../../tasks/BuildTask.js'
import { findPath } from '../../../systems/PathSystem.js'

export const BUILDER = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)
  let targetBuilding = creature.village.buildings.find((b) => !b.isConstructed && !b.isUnreachable)

  if (!targetBuilding) {
    const inv = creature.village.inventory
    if ((inv.wood || 0) >= 30 && Math.random() < 0.2) {
      let type = 'HOUSE'
      const bList = creature.village.buildings

      if (!bList.some((b) => b.type === 'FARM') && inv.wood >= 40) {
        type = 'FARM'
        inv.wood -= 40
      } else if (
        bList.filter((b) => b.type === 'HOUSE').length < creature.village.creatures.length / 3 &&
        inv.wood >= 30
      ) {
        type = 'HOUSE'
        inv.wood -= 30
      } else if (!bList.some((b) => b.type === 'BARRACKS') && inv.wood >= 50 && inv.stone >= 20) {
        type = 'BARRACKS'
        inv.wood -= 50
        inv.stone -= 20
      } else if (!bList.some((b) => b.type === 'SMITHY') && inv.wood >= 40 && inv.stone >= 30) {
        type = 'SMITHY'
        inv.wood -= 40
        inv.stone -= 30
      } else if (!bList.some((b) => b.type === 'SCHOOL') && inv.wood >= 60) {
        type = 'SCHOOL'
        inv.wood -= 60
      } else if (
        !bList.some((b) => b.type === 'TEMPLE') &&
        inv.wood >= 100 &&
        inv.stone >= 50 &&
        inv.gold >= 10
      ) {
        type = 'TEMPLE'
        inv.wood -= 100
        inv.stone -= 50
        inv.gold -= 10
      } else if (inv.wood >= 30) {
        type = 'HOUSE'
        inv.wood -= 30
      }

      // 💡 Terrain-Aware Spawning: Find a safe place for the building
      let spawnX, spawnY, isValid = false
      for (let attempt = 0; attempt < 10; attempt++) {
        spawnX = creature.village.x + (Math.random() - 0.5) * 180
        spawnY = creature.village.y + (Math.random() - 0.5) * 180
        
        if (world.terrain) {
          const cols = Math.ceil(world.width / 16)
          const tx = Math.floor(spawnX / 16)
          const ty = Math.floor(spawnY / 16)
          const type = world.terrain[ty * cols + tx]
          if (type !== 2 && type < 3) {
            isValid = true
            break
          }
        } else {
          isValid = true
          break
        }
      }

      if (isValid) {
        world.spawnBuilding(spawnX, spawnY, type, creature.village)
      } else {
        console.warn('[Builder] 마을 주변에 건물을 지을만한 마땅한 땅이 없습니다.');
        creature.wander(world)
      }
      return
    } else {
      creature.wander(world)
    }
  } else {
    console.log('[DEBUG] 1. 건설 프로세스 진입: ', targetBuilding.id);
    
    // 💡 경로 탐색 시도 (A* with MAX_ITERATIONS)
    const path = findPath(world, creature, targetBuilding);
    console.log('[DEBUG] 2. 길찾기 시도 완료');

    if (path) {
      // 경로가 있다면 이동 및 건설 타스크 할당 (중복 주입 방지)
      if (creature.taskQueue.length === 0) {
        creature.taskQueue.push(new MoveTask(targetBuilding))
        creature.taskQueue.push(new BuildTask(targetBuilding))
        console.log('[DEBUG] 3. 이동 및 건설 타스크 부여 완료');
      }
    } else {
      console.log('[DEBUG] 2-1. 경로를 찾을 수 없어 건설이 취소되었습니다.');
      targetBuilding.isUnreachable = true; // 도달 불가 마킹으로 다음 프레임 탐색 제외
      creature.wander(world);
    }
  }
}
