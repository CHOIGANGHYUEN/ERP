export class UtilityScoringService {
  /**
   * 점수 계산: 시그모이드(Sigmoid) 곡선을 활용해 임계치 지연 효과 구현
   * 수치가 높을수록(욕구가 클수록) 점수가 급격히 상승함
   */
  calculateSigmoid(value, threshold, k = 0.2) {
    const x = value - threshold // 수치가 임계치를 넘을 때부터 점수 증가
    return 100 / (1 + Math.exp(-k * x))
  }

  /**
   * 크리처의 모든 욕구 점수와 마을의 공동 필요를 계산하여 가장 시급한 행동 타입 반환
   * @param {object} creature { needs, village, profession, ... }
   */
  getBestAction(creature) {
    const { needs, village, profession } = creature

    // 1. 개인 생존 점수 (Hunger, Fatigue, Health)
    const survivalScores = [
      { type: 'REST', score: this.calculateSigmoid(needs?.fatigue || 0, 20, 0.15) },
      { type: 'EAT', score: this.calculateSigmoid(needs?.hunger || 0, 30, 0.1) },
      // 💡 [버그 수정] 체력이 낮을수록(100 - health) 회복 욕구가 커지도록 반전
      { type: 'HEAL', score: this.calculateSigmoid(100 - (creature.health || 100), 40, 0.2) }
    ]

    // 2. 마을 자원 상태 및 직업 기반 의무(WORK) 점수 계산
    let workMotivation = 30 // 기본 근로 동기

    if (village) {
      const inv = village.inventory || {}
      const pop = village.creatures?.length || 1

      // 부족도(Scarcity) 계산 (0~100)
      const foodScarcity = Math.max(0, 100 - (inv.food / (pop * 2)) * 100)
      const woodScarcity = Math.max(0, 100 - (inv.wood / (pop * 2)) * 100)
      const stoneScarcity = Math.max(0, 100 - (inv.stone / 30) * 100)

      // 직업별 가중치 부여
      if (profession === 'FARMER' || profession === 'GATHERER') {
        workMotivation += foodScarcity * 0.7
      } else if (profession === 'LUMBERJACK') {
        workMotivation += woodScarcity * 0.7
      } else if (profession === 'MINER') {
        workMotivation += stoneScarcity * 0.7
      } else if (profession === 'BUILDER') {
        const needsBuild = (village.buildingCounts?.unconstructed || 0) > 0
        if (needsBuild) workMotivation += 50
      }

      // 마을 전체의 비상 상황 (식품 고갈 등) 시 모든 주민의 근로 동기 상승
      if (foodScarcity > 80) workMotivation += 20
    }

    // 최종 결정: 생존 욕구 중 가장 높은 것과 업무 동기 비교
    survivalScores.sort((a, b) => b.score - a.score)

    // 생존 욕구가 업무 동기보다 낮으면 사회적 업무(WORK) 수행
    if (survivalScores[0].score < workMotivation) {
      return 'WORK'
    }

    return survivalScores[0].type
  }
}
