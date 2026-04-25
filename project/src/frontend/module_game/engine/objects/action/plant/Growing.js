import { PlantEmotion } from '../../emotions/PlantEmotion.js'

export const GROWING = (plant, deltaTime, world) => {
  plant.age += deltaTime / 10 // 생물 노화 속도 10배 느리게 동기화
  PlantEmotion.update(plant, deltaTime, world)

  // 💡 [경제 시스템 개편] 비옥도는 스폰 시 한 번에 지불하므로 유지(성장) 비용은 없음
  if (
    plant.emotions.vitality > 50 &&
    plant.size < plant.maxSize &&
    world.season !== 'WINTER'
  ) {
    const growth = deltaTime * 0.002
    plant.size += growth
  }

  // 식물 알고리즘: 주변 환경에 따라 점진적으로 번식 (포자/씨앗 퍼트리기) - 농작물은 스스로 번식 안 함
  if (
    plant.type !== 'crop' &&
    plant.age > plant.maxAge * 0.3 &&
    Math.random() < 0.0005 * deltaTime &&
    world.season !== 'WINTER' &&
    plant.emotions.vitality > 80 // 활력이 넘쳐야만 번식 가능
  ) {
    const offsetX = (Math.random() - 0.5) * 80
    const offsetY = (Math.random() - 0.5) * 80
    // 💡 번식 시 비옥도 차감 및 조건 검사는 EntitySpawnerSystem.spawnPlant 에서 전담
    world.spawnPlant(plant.x + offsetX, plant.y + offsetY, plant.type)
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
