import { AnimalEmotion } from '../emotions/AnimalEmotion.js'
import { AnimalActions } from '../action/AnimalActions.js'
import { AnimalRenders } from '../renders/AnimalRenders.js'

/**
 * AnimalSet
 * 동물의 감정(Emotion), 행동/판단(Action), 화면그리기(Render) 의존성을
 * 일체형 세트(Set)로 주입하기 위한 번들 객체입니다.
 */
export const AnimalSet = {
  emotion: AnimalEmotion,
  action: AnimalActions,
  render: AnimalRenders,
  
  // 개체 생성 시 세트 전체 초기화
  init: (animal) => {
    AnimalEmotion.init(animal)
  },

  // 매 프레임 감정 평가 및 행동 실행
  update: (animal, deltaTime, world) => {
    // 1. 감정 및 스탯(배고픔, 피로 등) 업데이트
    AnimalEmotion.update(animal, deltaTime)

    // 동물의 두뇌 AI 평가 주기 (0.5초)
    animal.aiTickTimer = (animal.aiTickTimer || 0) - deltaTime
    if (animal.aiTickTimer <= 0) {
      animal.aiTickTimer = 500 + Math.random() * 500
      const searchRange = { x: animal.x - 200, y: animal.y - 200, width: 400, height: 400 }
      const candidates = world.chunkManager.query(searchRange)

      // 2. 욕구 판단에 따른 새로운 행동(Action) 상태 개시(Start)
      const drive = AnimalEmotion.evaluateSurvivalNeeds(animal, candidates)
      if (drive && AnimalActions[drive.action]) {
        const actionObj = AnimalActions[drive.action]
        if (actionObj.start) actionObj.start(animal, drive.target, world)
      } else if (animal.state === 'WANDERING' || animal.state === 'IDLE') {
        if (Math.random() < 0.05) animal.wander(world)
      }
    }

    // 3. 현재 부여된 상태(State) 기반 전략 행동 실행 (Execute update)
    // AnimalActions[animal.state] 가 존재하면 해당 모듈의 execute() 호출
    const actionObj = AnimalActions[animal.state]
    if (actionObj && actionObj.execute) {
      actionObj.execute(animal, deltaTime, world)
    }
  },

  draw: (animal, ctx, timestamp, world) => {
    const renderAction = AnimalRenders[animal.state]
    if (renderAction) {
      renderAction(animal, ctx, timestamp, world)
    }
  }
}
