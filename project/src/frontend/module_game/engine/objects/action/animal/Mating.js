import { MAX_ANIMALS } from '../../../core/SharedState.js'

export const MATING = (animal, deltaTime, world) => {
  if (!animal.target || animal.target.isDead) {
    animal.state = 'WANDERING'
    return
  }

  // 대상 동물을 향해 이동
  animal.moveToTarget(animal.target.x, animal.target.y, deltaTime, world)

  // 💡 [무한 루프 방지] 번식 시도 타임아웃 (10초 지나면 포기)
  animal._matingTimer = (animal._matingTimer || 0) + deltaTime
  if (animal._matingTimer > 10000) {
    animal._matingTimer = 0
    animal.state = 'WANDERING'
    animal.target = null
    return
  }

  // 서로 접근 시 번식 로직 (10 단위 이내) 트리거
  if (animal.distanceTo(animal.target) < 10) {
    animal._matingTimer = 0 // 성공 시 타이머 초기화
    // 쿨타임 및 행복도 소모
    animal.emotions.happy -= 50
    animal.target.emotions.happy -= 50

    // 번식 스폰 (개체 수 제한 체크)
    if (world.animals.length < MAX_ANIMALS) {
      if (world.isHeadless) {
        // 백그라운드 Worker 환경이므로 직접 인스턴스 생성
        world.spawnAnimal(animal.x, animal.y, animal.type)
        // 방금 태어난 동물은 아기 상태여야 하므로 배열 마지막 꺼내서 종족 강제 삽입
        const baby = world.animals[world.animals.length - 1]
        baby.species = animal.species
        baby.baseSize = animal.baseSize
        baby.color = animal.color
        baby.size = baby.baseSize * 0.5
        baby.age = 0
      } else {
         // 메인 렌더 스레드 강제 소환 명령(일반적으로 사용 안 함)
         world.spawnAnimal(animal.x, animal.y, animal.type)
      }

      // 하트 이펙트 효과 (이벤트)
      if (world.broadcastEvent) {
         world.broadcastEvent('❤️ 아기 동물이 태어났습니다!', '#e74c3c')
      }
    }
    
    animal.state = 'WANDERING'
    animal.target = null
  }
}
