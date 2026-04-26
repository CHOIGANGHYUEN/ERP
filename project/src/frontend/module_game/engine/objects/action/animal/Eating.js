import { AnimalEmotion } from '../../emotions/AnimalEmotion.js'

export const EATING = (animal, deltaTime, world) => {
  if (!animal.target || animal.target.isDead) {
    animal.state = 'WANDERING'
    animal.target = null
    return
  }

  if (animal.distanceTo(animal.target) < animal.size + (animal.target.size || 0) + 5) {
    // 💡 [크기 비례] 큰 동물은 먹이를 빨리 뜯어먹고(sizeRatio), 포만감은 적게 참(invSizeRatio)
    const sizeRatio = (animal.baseSize || 10) / 10
    const invSizeRatio = 10 / (animal.baseSize || 10)

    if (animal.target.energy !== undefined) {
      animal.target.energy -= deltaTime * 0.1 * sizeRatio
      animal.energy = Math.min(100, animal.energy + deltaTime * 0.05 * invSizeRatio)

      // 💡 [버그 수정] 먹는 도중 프레임당 점진적 포만감 충전
      AnimalEmotion.fulfillHunger(animal, deltaTime * 0.15)

      if (animal.target.energy <= 0) {
        animal.target.die(world)
        animal.state = 'WANDERING'
        animal.target = null
      }
    } else {
      animal.target.die(world)
      animal.energy = Math.min(100, animal.energy + 30 * invSizeRatio)
      animal.state = 'WANDERING'
      animal.target = null
      AnimalEmotion.fulfillHunger(animal, 100)
    }
  } else {
    animal.moveToTarget(animal.target.x, animal.target.y, deltaTime, world)
  }
}
