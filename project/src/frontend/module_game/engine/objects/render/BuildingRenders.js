import { RenderUtils } from '../../utils/RenderUtils.js'

export const BuildingRenders = {
  render: (building, ctx, world) => {
    // 기존 그림자는 LightingSystem에서 통합 관리하므로 여기서 중복 제거 가능
    // 하지만 건물 고유의 접촉면 그림자가 필요할 수 있으므로 아주 옅게 유지
    ctx.save()
    ctx.globalAlpha = 0.1
    RenderUtils.drawShadow(ctx, building.x, building.y - 2, building.size * 1.2, 4)
    ctx.restore()

    if (!building.isConstructed) {
      BuildingRenders.renderConstruction(building, ctx, world)
    } else {
      BuildingRenders.renderFinished(building, ctx, world)
    }
  },

  renderConstruction: (building, ctx, _world) => {
    const s = building.size
    const x = building.x
    const y = building.y
    const progress = building.progress / building.maxProgress

    // 건설 중인 비계(Scaffolding) 느낌
    ctx.strokeStyle = '#7f8c8d'
    ctx.lineWidth = 2
    ctx.strokeRect(x - s / 2, y - s / 2, s, s)
    
    // 내부 공사 진행률 채우기
    ctx.fillStyle = 'rgba(149, 165, 166, 0.4)'
    ctx.fillRect(x - s / 2, y + s / 2 - s * progress, s, s * progress)

    RenderUtils.drawBar(ctx, x, y - s / 2 - 10, s, 5, progress, '#34495e', '#f1c40f')
  },

  renderFinished: (building, ctx, world) => {
    const s = building.size
    const x = building.x
    const y = building.y
    const color = building.color
    const isNight = world.timeSystem?.timeOfDay < 5000 || world.timeSystem?.timeOfDay > 19000

    ctx.save()
    
    // 1. 벽면 (Main Body with Depth)
    const darkColor = '#7f8c8d' // 입체감을 위한 어두운 면
    ctx.fillStyle = darkColor
    ctx.fillRect(x - s / 2, y - s / 2, s, s) // 옆면 베이스
    
    ctx.fillStyle = color
    ctx.fillRect(x - s / 2, y - s / 2, s * 0.8, s) // 정면 밝은 면
    
    // 2. 지붕 (Isometric Roof)
    const roofColor = '#2c3e50'
    ctx.fillStyle = roofColor
    ctx.beginPath()
    ctx.moveTo(x - s / 2 - 4, y - s / 2)
    ctx.lineTo(x + s / 2 + 4, y - s / 2)
    ctx.lineTo(x + s / 2, y - s * 0.9)
    ctx.lineTo(x - s / 2, y - s * 0.9)
    ctx.closePath()
    ctx.fill()
    
    // 지붕 릿지 (Ridge line)
    ctx.strokeStyle = '#34495e'
    ctx.lineWidth = 1
    ctx.stroke()

    // 3. 창문 & 문 (Glow effect at night)
    const windowColor = isNight ? '#f1c40f' : '#2980b9'
    if (isNight) {
      ctx.shadowBlur = 10
      ctx.shadowColor = '#f1c40f'
    }
    
    ctx.fillStyle = windowColor
    // 창문
    ctx.fillRect(x - s * 0.3, y - s * 0.3, s * 0.2, s * 0.2)
    // 문
    ctx.fillStyle = '#795548'
    ctx.fillRect(x + s * 0.1, y + s * 0.1, s * 0.2, s * 0.3)

    ctx.restore()

    const iconMap = {
      HOUSE: '🏠', SCHOOL: '🏫', FARM: '🌾', BARRACKS: '⛺',
      TEMPLE: '⚪', SMITHY: '⚒️', MARKET: '🏪'
    }

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${iconMap[building.type] || '🏗️'} Lv.${building.tier}`, x, y - s - 5)
  }
}
