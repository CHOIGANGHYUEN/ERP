/**
 * 지능형 상호작용(AI Interaction) 시각화 시스템
 * 개체 간의 대화(말풍선), 감정 이모지 등을 렌더링합니다.
 */
export class InteractionSystem {
  constructor() {
    this.bubbles = []
    this.entityMap = new Map() // [Optimization] 매 프레임 Map 생성을 피하기 위해 재사용
  }

  addBubble(entityId, entityType, text, duration = 2000) {
    // 같은 개체의 기존 말풍선 제거 (새로운 대화로 덮어쓰기)
    this.bubbles = this.bubbles.filter(
      (b) => !(b.entityId === entityId && b.entityType === entityType),
    )
    this.bubbles.push({ entityId, entityType, text, lifeTime: duration, maxLife: duration })
  }

  update(deltaTime, world) {
    if (world && world.spatialProxies) {
      // 말풍선을 위한 빠른 맵핑 (O(N) -> O(1)) - 기존 Map 재사용 (Zero-Allocation)
      this.entityMap.clear()
      // 현재 씬의 유효한 개체들을 맵에 캐싱
      for (let i = 0; i < world.spatialProxies.length; i++) {
        const p = world.spatialProxies[i]
        this.entityMap.set(`${p._type}_${p.id}`, p)
      }

      this.bubbles.forEach((b) => {
        // 동물과 크리처 구분 처리 포함 빠른 조회
        const proxy =
          this.entityMap.get(`${b.entityType}_${b.entityId}`) ||
          this.entityMap.get(`${b.entityType === 'animal' ? 'animal' : b.entityType}_${b.entityId}`)
        if (proxy) {
          b.x = proxy.x
          b.y = proxy.y
          b.size = proxy.size || 16
        }
      })
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      this.bubbles[i].lifeTime -= deltaTime
      if (this.bubbles[i].lifeTime <= 0) {
        this.bubbles.splice(i, 1)
      }
    }
  }

  render(ctx, _drawables) {
    if (this.bubbles.length === 0) return

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.font = 'bold 12px "Pretendard", sans-serif'

    this.bubbles.forEach((b) => {
      // proxy를 찾지 못해 좌표가 없는 말풍선은 렌더링 스킵
      if (b.x === undefined || b.y === undefined) return

      const alpha = Math.min(1, b.lifeTime / 300) // 마지막 300ms 동안 서서히 페이드아웃
      ctx.globalAlpha = alpha

      const textWidth = ctx.measureText(b.text).width
      const paddingX = 8
      const paddingY = 6
      const boxWidth = textWidth + paddingX * 2
      const boxHeight = 22
      const x = b.x
      const y = b.y - b.size - 8 // 개체 머리 위로 띄움

      // 말풍선 배경
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x - boxWidth / 2, y - boxHeight, boxWidth, boxHeight, 8)
      ctx.fill()
      ctx.stroke()

      // 말풍선 꼬리 (아래쪽 뾰족한 부분)
      ctx.beginPath()
      ctx.moveTo(x - 5, y)
      ctx.lineTo(x + 5, y)
      ctx.lineTo(x, y + 5)
      ctx.fill()

      // 텍스트 그리기
      ctx.fillStyle = '#2c3e50'
      ctx.fillText(b.text, x, y - paddingY)
    })

    ctx.restore()
  }
}
