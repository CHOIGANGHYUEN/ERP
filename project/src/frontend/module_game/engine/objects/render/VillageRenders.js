export const VillageRenders = {
  render: (village, ctx) => {
    const rx = village.radius
    const x = village.x
    const y = village.y
    const color = village.nation ? village.nation.color : '#ffffff'

    ctx.save()
    // 💡 [Grid Territory Rendering] 반경 기반 원형 렌더링을 완전히 제거하고, 
    // Grid 맵에서 내 마을에 해당하는 셀들을 하나의 거대한 폴리곤망처럼 일괄(batching) 렌더링합니다.
    if (world && world.settings && world.settings.showTerritory === false) {
       ctx.restore()
       // 이름은 항상 표시
       ctx.fillStyle = '#fff'
       ctx.font = 'bold 12px Arial'
       ctx.textAlign = 'center'
       ctx.fillText(village.name || 'Village', village.x, village.y - 10)
       return
    }

    if (world && world.views && world.views.territory) {
      const territory = world.views.territory
      // RenderProxy(마을)의 id 속성은 보통 인덱스입니다. (0-based)
      // Village.js와 BufferSyncSystem.js에서 어떻게 proxy.id를 설정했느냐에 따름.
      // RenderSystem.js 139라인 주변: world.bufferSyncSystem.hydrate(world, v, 'village', i, ..)
      // 따라서 v.id 는 인덱스이고, 마을 소유권은 `id + 1` 로 기록해두었습니다.
      const vId = (village.id || 0) + 1
      const cols = 200 // Math.ceil(3200 / 16)
      const maxIdx = territory.length

      // 1. 내부 영역 칠하기 (반투명 통합 Fill)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.15
      ctx.beginPath()
      for (let i = 0; i < maxIdx; i++) {
        if (territory[i] === vId) {
          const tx = (i % cols) * 16
          const ty = Math.floor(i / cols) * 16
          // rect를 계속 추가 (오버랩 방지)
          ctx.rect(tx, ty, 16, 16)
        }
      }
      ctx.fill()

      // 2. 외곽선(Border)만 선별해서 그리기 (개별 타일 윤곽 제거, 거대한 폐쇄 곡선화)
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.setLineDash([10, 5]) // 점선으로 세련미 추가 (기존 스타일 유지)
      ctx.globalAlpha = 0.6
      ctx.lineCap = 'square'
      
      ctx.beginPath()
      for (let i = 0; i < maxIdx; i++) {
        if (territory[i] === vId) {
          const tx = (i % cols) * 16
          const ty = Math.floor(i / cols) * 16
          
          // 상하좌우가 내 땅이 아니면 선을 그림 (Marching 엣지)
          // Top edge
          if (i < cols || territory[i - cols] !== vId) {
            ctx.moveTo(tx, ty)
            ctx.lineTo(tx + 16, ty)
          }
          // Bottom edge
          if (i >= maxIdx - cols || territory[i + cols] !== vId) {
            ctx.moveTo(tx, ty + 16)
            ctx.lineTo(tx + 16, ty + 16)
          }
          // Left edge
          if (i % cols === 0 || territory[i - 1] !== vId) {
            ctx.moveTo(tx, ty)
            ctx.lineTo(tx, ty + 16)
          }
          // Right edge
          if (i % cols === cols - 1 || territory[i + 1] !== vId) {
            ctx.moveTo(tx + 16, ty)
            ctx.lineTo(tx + 16, ty + 16)
          }
        }
      }
      ctx.stroke()
      
      // 3. 외곽 글로우 효과 (선 한 번 더 그림)
      ctx.setLineDash([])
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.2
      ctx.stroke()
    }

    ctx.restore()

    // 마을 이름 표시 (중앙)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(village.name || 'Village', village.x, village.y - 10)
  }
}
