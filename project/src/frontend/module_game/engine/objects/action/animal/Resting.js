export const RESTING = (animal, deltaTime, world) => {
  // 제자리에 서서 수면 (피로도 감소)
  animal.needs.fatigue -= (deltaTime / 1000) * 10.0 // 굉장히 빠른 피로 회복
  
  if (animal.needs.fatigue <= 0) {
    animal.needs.fatigue = 0
    animal.state = 'WANDERING'
  }
}
