export const GROWING = (plant, ctx, timestamp, windSpeed) => {
  const sway = Math.sin(timestamp * 0.003 + plant.x * 0.01) * windSpeed * (plant.size * 0.1)

  if (plant.type === 'tree') {
    // 🌳 나무 줄기 (Outline + Fill)
    ctx.fillStyle = '#4b2c20' // 다크 아웃라인
    ctx.fillRect(plant.x - plant.size / 5 - 1, plant.y - plant.size - 1, plant.size / 2.5 + 2, plant.size + 2)
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(plant.x - plant.size / 5, plant.y - plant.size, plant.size / 2.5, plant.size)
    
    // 풍성한 잎사귀 (레이어드 아웃라인 스타일)
    const drawLeaf = (ox, oy, sz, col) => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)' // 그림자
      ctx.beginPath(); ctx.arc(plant.x + sway + ox + 1, plant.y - plant.size + oy + 1, sz, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = col
      ctx.beginPath(); ctx.arc(plant.x + sway + ox, plant.y - plant.size + oy, sz, 0, Math.PI * 2); ctx.fill()
      // 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath(); ctx.arc(plant.x + sway + ox - sz*0.3, plant.y - plant.size + oy - sz*0.3, sz*0.4, 0, Math.PI * 2); ctx.fill()
    }
    
    drawLeaf(0, -plant.size * 0.2, plant.size * 0.9, plant.color)
    drawLeaf(-plant.size * 0.4, 0, plant.size * 0.7, plant.color)
    drawLeaf(plant.size * 0.4, 0, plant.size * 0.7, plant.color)

  } else if (plant.type === 'crop') {
    // 🌽 농작물
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(plant.x - plant.size / 4 + sway + 1, plant.y - plant.size + 1, plant.size / 2, plant.size)
    ctx.fillStyle = plant.color
    ctx.fillRect(plant.x - plant.size / 4 + sway, plant.y - plant.size, plant.size / 2, plant.size)
    
    if (plant.size > plant.maxSize * 0.5) {
      ctx.fillStyle = '#fa8231' // 더 선명한 열매 색상
      ctx.fillRect(plant.x - plant.size / 3 + sway, plant.y - plant.size - 4, plant.size * 0.6, 6)
    }
  } else {
    // 🌿 풀/꽃
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 2
    ctx.fillStyle = plant.color
    ctx.beginPath()
    ctx.moveTo(plant.x, plant.y)
    ctx.quadraticCurveTo(plant.x + sway * 0.5, plant.y - plant.size * 0.5, plant.x + sway, plant.y - plant.size)
    ctx.quadraticCurveTo(plant.x - 2, plant.y - plant.size * 0.5, plant.x - 3, plant.y)
    ctx.stroke()
    ctx.fill()
  }
}
