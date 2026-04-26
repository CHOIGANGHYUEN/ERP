import { AnimalEmotion } from '../../emotions/AnimalEmotion.js'
import { findPath } from '../../../systems/PathSystem.js'

export const HUNTING = (animal, deltaTime, world) => {
  if (!animal.target || animal.target.isDead) {
    animal.state = 'WANDERING'
    animal.target = null
    animal._needsPathfinding = false
    return
  }

  if (animal.distanceTo(animal.target) < animal.size + (animal.target.size || 0) + 5) {
    animal._needsPathfinding = false
    const sizeRatio = (animal.baseSize || 10) / 10
    const invSizeRatio = 10 / (animal.baseSize || 10)

    if (animal.target.energy !== undefined) {
      // 💡 [크기 비례] 큰 포식자는 먹잇감의 체력을 더 빨리 깎아냄
      animal.target.energy -= deltaTime * 0.1 * sizeRatio
      animal.energy = Math.min(100, animal.energy + deltaTime * 0.05 * invSizeRatio)

      // 사냥하며 물어뜯는 동안 점진적인 포만감 증가
      if (animal.type === 'CARNIVORE') {
        AnimalEmotion.fulfillHunger(animal, deltaTime * 0.15)
      }

      if (animal.target.energy <= 0) {
        const speciesName = animal.species || animal.type || '육식동물'

        if (animal.type === 'CARNIVORE') {
          animal.target.die(world, `${speciesName}에게 사냥당해 사망`)
          animal.bloodTimer = 20000 // 사냥 성공 시 포식자 피 묻음
          AnimalEmotion.fulfillHunger(animal, 50) // 사냥 성공 보너스 포만감
        } else {
          animal.target.die(world, `${speciesName}의 방어적인 공격을 받아 사망`)
        }

        animal.state = 'WANDERING'
        animal.target = null
      }
    } else {
      const speciesName = animal.species || animal.type || '육식동물'

      if (animal.type === 'CARNIVORE') {
        animal.target.die(world, `${speciesName}에게 사냥당해 사망`)
        animal.energy = Math.min(100, animal.energy + 30 * invSizeRatio)
        animal.bloodTimer = 20000
        AnimalEmotion.fulfillHunger(animal, 100)
      } else {
        animal.target.die(world, `${speciesName}의 방어적인 공격을 받아 사망`)
      }

      animal.state = 'WANDERING'
      animal.target = null
    }
  } else {
    // 💡 [Phase 2] 사냥 중 장애물에 숨은 먹잇감을 A*로 추적
    if (animal._needsPathfinding && world.pathSystem) {
      const path = findPath(world, animal, animal.target)
      if (path && path.length > 1) {
        animal.moveToTarget(path[1].x, path[1].y, deltaTime, world)
      } else {
        animal.moveToTarget(animal.target.x, animal.target.y, deltaTime, world)
      }
    } else {
      animal.moveToTarget(animal.target.x, animal.target.y, deltaTime, world)
    }
  }
}
