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
      this.entityMap.clear()
      // 💡 [렌더링 최적화] 매 프레임 수만 개의 문자열(`type_id`)을 생성하며 발생하는 GC 메모리 부하를 막기 위해 비트 연산 기반 정수 Key 사용
      const typeMap = {
        creature: 0,
        animal: 1,
        plant: 2,
        building: 3,
        tornado: 4,
        mine: 5,
        resource: 6,
        village: 7,
      }
      for (let i = 0; i < world.spatialProxies.length; i++) {
        const p = world.spatialProxies[i]
        const t = typeMap[p._type] || 0
        this.entityMap.set((t << 20) | p.id, p)
      }

      this.bubbles.forEach((b) => {
        // 동물과 크리처 구분 처리 포함 빠른 조회
        const tStr = b.entityType === 'animal' ? 'animal' : b.entityType
        const t = typeMap[tStr] || 0
        const proxy = this.entityMap.get((t << 20) | b.entityId)
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
      if (b.x === undefined || b.y === undefined || Number.isNaN(b.x) || Number.isNaN(b.y)) return

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
