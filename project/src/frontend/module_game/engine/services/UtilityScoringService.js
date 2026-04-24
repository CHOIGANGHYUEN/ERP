export class UtilityScoringService {
  /**
   * 점수 계산: 시그모이드(Sigmoid) 곡선을 활용해 임계치 지연 효과 구현
   * @param {number} value 현재 수치 (0~100)
   * @param {number} threshold 임계치 (이 수치 아래로 내려갈 때까지 점수가 급격히 상승하지 않음)
   * @param {number} k 기울기 (감도)
   */
  calculateSigmoid(value, threshold, k = 0.2) {
    // 0~100 스케일의 value를 threshold 기준으로 반전하여 점수화
    // 배고픔이 100이면 점수 0, 배고픔이 0이면 점수 100
    const x = threshold - value
    return 100 / (1 + Math.exp(-k * x))
  }

  /**
   * 크리처의 모든 욕구 점수를 계산하여 가장 시급한 행동 타입 반환
   * @param {object} creatureStats { hunger, fatigue, health, etc }
   */
  getBestAction(creatureStats) {
    const scores = [
      { type: 'REST', score: this.calculateSigmoid(creatureStats.fatigue, 20, 0.15) },
      { type: 'EAT', score: this.calculateSigmoid(creatureStats.hunger, 30, 0.1) },
      { type: 'HEAL', score: this.calculateSigmoid(creatureStats.health, 40, 0.2) }
    ]

    // 점수가 높은 순으로 정렬
    scores.sort((a, b) => b.score - a.score)

    // 임계 점수(예: 30점)를 넘지 못하면 일반 업무(WORK)를 유지하도록 유도
    if (scores[0].score < 30) {
      return 'WORK'
    }

    return scores[0].type
  }
}
