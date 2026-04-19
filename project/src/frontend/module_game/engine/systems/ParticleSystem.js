/**
 * 다이나믹 파티클(Particle) 엔진
 * 채집, 전투, 마법 이펙트 등 시각적 피드백을 제공하기 위한 범용 시스템
 */
export class ParticleSystem {
  constructor() {
    this.particles = []
    this.pool = [] // GC 부하 방지용 풀
  }

  emit(x, y, config = {}) {
    const count = config.count || 5
    for (let i = 0; i < count; i++) {
      const p = this.pool.length > 0 ? this.pool.pop() : {}
      p.x = x
      p.y = y
      const angle = config.angle !== undefined ? config.angle : Math.random() * Math.PI * 2
      const spread = config.spread !== undefined ? config.spread : Math.PI * 2
      const finalAngle = angle + (Math.random() - 0.5) * spread
      const speed = (config.speed || 50) * (0.5 + Math.random() * 0.5)

      p.vx = Math.cos(finalAngle) * speed
      p.vy = Math.sin(finalAngle) * speed
      p.life = config.life || 1000
      p.maxLife = p.life
      p.color = config.color || '#ffffff'
      p.size = config.size || 3
      p.friction = config.friction || 0.95
      this.particles.push(p)
    }
  }

  update(deltaTime) {
    const dt = deltaTime / 1000
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= p.friction // 공기 저항
      p.vy *= p.friction
      p.life -= deltaTime
      if (p.life <= 0) {
        this.pool.push(p)
        // [Optimization] splice 대신 swap-and-pop 사용
        this.particles[i] = this.particles[this.particles.length - 1]
        this.particles.pop()
      }
    }
  }

  render(ctx) {
    if (this.particles.length === 0) return
    ctx.save()
    this.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.restore()
  }
}
