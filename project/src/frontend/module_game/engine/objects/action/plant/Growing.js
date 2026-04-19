import { PlantEmotion } from '../../emotions/PlantEmotion.js'

export const GROWING = (plant, deltaTime, world) => {
  plant.age += deltaTime / 10 // 생물 노화 속도 10배 느리게 동기화
  PlantEmotion.update(plant, deltaTime, world)

  // 감정 모듈에서 활력이 충만할 때만 비옥도 소모하며 성장
  if (
    plant.emotions.vitality > 50 &&
    plant.size < plant.maxSize &&
    world.currentFertility > 0 &&
    world.season !== 'WINTER'
  ) {
    const growth = deltaTime * 0.002
    const cost = growth * (plant.type === 'tree' ? 5 : plant.type === 'crop' ? 3 : 2)

    if (world.currentFertility >= cost) {
      plant.size += growth
      world.currentFertility -= cost
    }
  }

  // 식물 알고리즘: 주변 환경에 따라 점진적으로 번식 (포자/씨앗 퍼트리기) - 농작물은 스스로 번식 안 함
  if (
    plant.type !== 'crop' &&
    plant.age > plant.maxAge * 0.3 &&
    Math.random() < 0.0005 * deltaTime &&
    world.season !== 'WINTER' &&
    plant.emotions.vitality > 80 // 활력이 넘쳐야만 번식 가능
  ) {
    const spawnCost = plant.type === 'tree' ? 20 : 5
    if (world.currentFertility >= spawnCost) {
      const offsetX = (Math.random() - 0.5) * 80
      const offsetY = (Math.random() - 0.5) * 80
      // 캔버스 범위를 벗어나지 않도록 World에서 필터링
      world.spawnPlant(plant.x + offsetX, plant.y + offsetY, plant.type)
      world.currentFertility -= spawnCost
    }
  }

  // 다 자란 농작물은 농부가 수확하지 않으면 시들어 죽음
  if (plant.type === 'crop' && plant.size >= plant.maxSize) {
    plant.emotions.vitality -= deltaTime * 0.01
  }

  if (
    (!plant.isImmortal && plant.age >= plant.maxAge) ||
    plant.energy <= 0 ||
    plant.emotions.vitality <= 0
  ) {
    plant.die(world)
  }
}
