export const VillageRenders = {
  render: (village, ctx) => {
    const rx = village.radius
    const x = village.x
    const y = village.y
    const color = village.nation ? village.nation.color : '#ffffff'

    ctx.save()
    // [Premium Design] 유닛들을 가리지 않도록 배경 뒤에 그림
    ctx.globalCompositeOperation = 'destination-over'

    // 1. 영역 내부 은은한 채우기 (복합 색상 대응)
    const grad = ctx.createRadialGradient(x, y, rx * 0.5, x, y, rx)
    
    // rgb() 형식 대응을 위해 직접적인 투명도 할당은 제외하고, 색상값만 사용
    grad.addColorStop(0, color) 
    grad.addColorStop(1, color)
    
    ctx.fillStyle = grad
    ctx.globalAlpha = 0.1 // 전체적인 투명도 적용 (빌드 오류 방지)
    ctx.beginPath()
    ctx.arc(x, y, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1.0 // 원복

    // 2. 경계선 (네온/광성 효과)
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.setLineDash([10, 5]) // 점선으로 세련미 추가
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.arc(x, y, rx, 0, Math.PI * 2)
    ctx.stroke()
    
    // 외곽 글로우 추가 효과 (선 하나 더 그림)
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.2
    ctx.beginPath()
    ctx.arc(x, y, rx + 4, 0, Math.PI * 2)
    ctx.stroke()

    ctx.restore()

    // 마을 이름 표시 (중앙)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(village.name || 'Village', village.x, village.y - 10)
  }
}
