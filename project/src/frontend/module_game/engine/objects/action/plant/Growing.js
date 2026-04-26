import { PlantEmotion } from '../../emotions/PlantEmotion.js'

export const GROWING = (plant, deltaTime, world) => {
  plant.age += deltaTime / 10 // 생물 노화 속도 10배 느리게 동기화
  PlantEmotion.update(plant, deltaTime, world)

  // 💡 [버그 수정] 땅의 비옥도와 식물 밀도를 연계하여 성장 및 번식의 최대량을 통제
  let currentFertility = 1.0
  if (world.terrainSystem && world.terrainSystem.getFertility) {
    currentFertility = world.terrainSystem.getFertility(plant.x, plant.y)
  }

  // 반경 내 동족 식물 밀도 측정
  const searchRange = { x: plant.x - 100, y: plant.y - 100, width: 200, height: 200 }
  const neighbors = world.chunkManager ? world.chunkManager.query(searchRange) : []
  let localDensity = 0
  for (const n of neighbors) {
    if (n._type === 'plant' && !n.isDead) localDensity++
  }

  // 비옥도에 비례하여 타일당 허용되는 최대 식물 밀도 산정
  const maxAllowedDensity = plant.type === 'crop' ? 15 * currentFertility : 8 * currentFertility

  if (localDensity > maxAllowedDensity + 2) {
    // 밀집도 한계 초과 시 양분 경쟁으로 활력 지속 감소
    plant.emotions.vitality -= deltaTime * 0.02
  }

  if (
    plant.emotions.vitality > 50 &&
    plant.size < plant.maxSize &&
    world.season !== 'WINTER' &&
    localDensity <= maxAllowedDensity // 허용 밀도 내에서만 성장
  ) {
    const growth = deltaTime * 0.002
    plant.size += growth

    if (world.terrainSystem && world.terrainSystem.consumeFertility) {
      world.terrainSystem.consumeFertility(plant.x, plant.y, deltaTime * 0.0001)
    }
  }

  if (
    plant.type !== 'crop' &&
    plant.age > plant.maxAge * 0.3 &&
    Math.random() < 0.0005 * deltaTime &&
    world.season !== 'WINTER' &&
    plant.emotions.vitality > 80 &&
    localDensity <= maxAllowedDensity // 한계 밀도 내에서만 번식 허용
  ) {
    const offsetX = (Math.random() - 0.5) * 80
    const offsetY = (Math.random() - 0.5) * 80
    world.spawnPlant(plant.x + offsetX, plant.y + offsetY, plant.type)

    // 번식에 성공하면 땅의 비옥도 소모
    if (world.terrainSystem && world.terrainSystem.consumeFertility) {
      world.terrainSystem.consumeFertility(plant.x, plant.y, 0.05)
    }
  }

  // 다 자란 농작물은 농부가 수확하지 않으면 시들어 죽음
  if (plant.type === 'crop' && plant.size >= plant.maxSize) {
    plant.emotions.vitality -= deltaTime * 0.01
  }

  // 💡 [경제 시스템 개편] 나무는 자연사하지 않으며, 다른 식물만 조건에 따라 소멸
  const shouldDie = plant.type !== 'tree' && (
    (!plant.isImmortal && plant.age >= plant.maxAge) ||
    plant.energy <= 0 ||
    plant.emotions.vitality <= 0
  )

  if (shouldDie) {
    plant.die(world)
  }
}
