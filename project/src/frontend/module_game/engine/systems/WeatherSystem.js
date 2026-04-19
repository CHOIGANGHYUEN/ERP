export class WeatherSystem {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.windSpeed = 2
    this.weatherType = 'clear' // 'clear', 'rain', 'fog'
    this.weatherTimer = 0
    this.particles = []
    this.pool = [] // [Optimization] GC 방지를 위한 입자 풀링
  }

  update(deltaTime) {
    this.weatherTimer -= deltaTime
    if (this.weatherTimer <= 0) {
      // 주기적으로 날씨와 바람 변경
      this.weatherTimer = 15000 + Math.random() * 20000
      const rand = Math.random()
      if (rand < 0.3) this.weatherType = 'rain'
      else if (rand < 0.6) this.weatherType = 'fog'
      else this.weatherType = 'clear'

      // 바람 세기 조정 (-5 ~ 5)
      this.windSpeed = (Math.random() - 0.5) * 10
    }

    if (this.weatherType === 'rain') {
      // 빗물 파티클 생성
      for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.5) {
          const p = this.pool.length > 0 ? this.pool.pop() : {}
          p.x = Math.random() * this.width
          p.y = -10
          p.vx = this.windSpeed * 0.5
          p.vy = 10 + Math.random() * 10
          p.life = 100
          this.particles.push(p)
        }
      }
    }

    // 파티클 업데이트
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i]
      p.x += p.vx * (deltaTime * 0.06)
      p.y += p.vy * (deltaTime * 0.06)
      p.life--
      if (p.life <= 0 || p.y > this.height) {
        this.pool.push(p)
        // [Optimization] splice 대신 swap-and-pop 사용
        this.particles[i] = this.particles[this.particles.length - 1]
        this.particles.pop()
      }
    }
  }

  render(ctx) {
    if (this.weatherType === 'rain') {
      ctx.strokeStyle = 'rgba(173, 216, 230, 0.4)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let p of this.particles) {
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2)
      }
      ctx.stroke()
    } else if (this.weatherType === 'fog') {
      ctx.fillStyle = 'rgba(200, 210, 220, 0.35)'
      ctx.fillRect(0, 0, this.width, this.height)
    }
  }
}
