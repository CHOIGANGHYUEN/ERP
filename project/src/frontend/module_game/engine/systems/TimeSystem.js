export class TimeSystem {
  constructor() {
    this.timeOfDay = 8000 // 0~24000 (8000 = 08:00 AM)
    this.days = 0
    this.season = 'SPRING' // SPRING, SUMMER, AUTUMN, WINTER
  }

  update(deltaTime) {
    // 시간 및 계절 업데이트 (1초 IRL = 250 tick, 하루 24000 = 96초 IRL)
    this.timeOfDay += deltaTime * 0.25
    if (this.timeOfDay >= 24000) {
      this.timeOfDay -= 24000
      this.days++
      // 5일마다 계절 변경
      if (this.days % 5 === 0) {
        const seasons = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER']
        this.season = seasons[(seasons.indexOf(this.season) + 1) % seasons.length]
      }
    }
  }

  renderOverlay(ctx, width, height) {
    // 💡 [자연 변화 실감 개선] 
    // 시간 및 날씨에 따른 하늘, 별빛, 노을, 조명 오버레이 연산은 모두 
    // LightingSystem.js 의 applyColorGrading으로 일원화되어 더 사실적으로 처리됩니다.
  }
}
