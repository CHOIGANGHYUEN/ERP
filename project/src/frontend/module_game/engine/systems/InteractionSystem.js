/**
 * 지능형 상호작용(AI Interaction) 시각화 시스템
 * 개체 간의 대화(말풍선), 감정 이모지 등을 렌더링합니다.
 */
export class InteractionSystem {
  constructor() {
    this.bubbles = []
  }

  addBubble(entityId, entityType, text, duration = 2000) {
    // 같은 개체의 기존 말풍선 제거 (새로운 대화로 덮어쓰기)
    this.bubbles = this.bubbles.filter(
      (b) => !(b.entityId === entityId && b.entityType === entityType),
    )
    this.bubbles.push({ entityId, entityType, text, lifeTime: duration, maxLife: duration })
  }

  update(deltaTime) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      this.bubbles[i].lifeTime -= deltaTime
      if (this.bubbles[i].lifeTime <= 0) {
        this.bubbles.splice(i, 1)
      }
    }
  }

  render(ctx, drawables) {
    if (this.bubbles.length === 0) return

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.font = 'bold 12px "Pretendard", sans-serif'

    this.bubbles.forEach((b) => {
      // 화면(Culling 뷰포트 내)에 렌더링 중인 개체만 말풍선 표시
      const entity = drawables.find((e) => e.id === b.entityId && e._type === b.entityType)
      if (!entity) return

      const alpha = Math.min(1, b.lifeTime / 300) // 마지막 300ms 동안 서서히 페이드아웃
      ctx.globalAlpha = alpha

      const textWidth = ctx.measureText(b.text).width
      const paddingX = 8
      const paddingY = 6
      const boxWidth = textWidth + paddingX * 2
      const boxHeight = 22
      const x = entity.x
      const y = entity.y - (entity.size || 16) - 8 // 개체 머리 위로 띄움

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
