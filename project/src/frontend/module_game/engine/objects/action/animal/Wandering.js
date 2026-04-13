import { Rectangle } from '../../../systems/QuadTree.js'
import { AnimalEmotion } from '../../emotions/AnimalEmotion.js'
export const WANDERING = (animal, deltaTime, world) => {
  if (Math.random() < 0.05) {
    // 4.1 QuadTree 최적화: 전체 배열 순회 대신 800x800 반경 내에서만 탐색
    const searchRange = new Rectangle(animal.x - 400, animal.y - 400, 800, 800)
    const candidates = world.quadTree.query(searchRange)

    // 감정(공포, 공격성)과 욕구(허기) 모듈을 통한 판단
    const survivalAction = AnimalEmotion.evaluateSurvivalNeeds(animal, candidates)
    if (survivalAction) {
      if (survivalAction.action === 'FLEE') {
        animal.targetX = animal.x + (animal.x - survivalAction.target.x)
        animal.targetY = animal.y + (animal.y - survivalAction.target.y)
        animal.moveToTarget(animal.targetX, animal.targetY, deltaTime, world, 1.5)
        return
      } else {
        animal.target = survivalAction.target
        animal.state = survivalAction.action === 'EAT' ? 'EATING' : 'HUNTING'
        return
      }
    } else animal.wander(world)
  }

  animal.moveToTarget(animal.targetX, animal.targetY, deltaTime, world)
}
