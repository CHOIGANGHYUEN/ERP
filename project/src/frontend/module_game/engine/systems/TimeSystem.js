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
    if (this.season === 'WINTER') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(0, 0, width, height)
    }

    let alpha = 0
    if (this.timeOfDay >= 18000 && this.timeOfDay < 20000)
      alpha = ((this.timeOfDay - 18000) / 2000) * 0.65 // Sunset
    else if (this.timeOfDay >= 20000 || this.timeOfDay < 4000)
      alpha = 0.65 // Night
    else if (this.timeOfDay >= 4000 && this.timeOfDay < 6000)
      alpha = 0.65 - ((this.timeOfDay - 4000) / 2000) * 0.65 // Sunrise

    if (alpha > 0) {
      ctx.fillStyle = `rgba(10, 10, 30, ${alpha})`
      ctx.fillRect(0, 0, width, height)
    }
  }
}
