import { MoveTask } from '../../tasks/MoveTask.js'
import { BuildTask } from '../../tasks/BuildTask.js'

export const BUILDER = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)
  let targetBuilding = creature.village.buildings.find((b) => !b.isConstructed)

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

      world.spawnBuilding(
        creature.village.x + (Math.random() - 0.5) * 180,
        creature.village.y + (Math.random() - 0.5) * 180,
        type,
        creature.village,
      )
    } else {
      creature.wander(world)
    }
  } else {
    creature.taskQueue.push(new MoveTask(targetBuilding))
    creature.taskQueue.push(new BuildTask(targetBuilding))
  }
}
