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
      // 💡 [버그 수정] 청사진(Blueprint) 상태일 때도 건물의 외형이 반투명하게 보이도록 추가
      ctx.save()
      ctx.globalAlpha = 0.3
      if (building.type === 'FARM') BuildingRenders.renderFarmCrops(building, ctx)
      BuildingRenders.renderFinished(building, ctx, world)
      ctx.restore()

      BuildingRenders.renderConstruction(building, ctx, world)
    } else {
      if (building.type === 'FARM') BuildingRenders.renderFarmCrops(building, ctx)
      BuildingRenders.renderFinished(building, ctx, world)
    }
  },

  renderConstruction: (building, ctx, _world) => {
    const s = building.size
    const x = building.x
    const y = building.y
    const progress = (building.progress || 0) / (building.maxProgress || 100)

    // 💡 [건축 중/대기] - 게이지를 항상 표시하여 부지 상태임을 알림
    if (progress <= 0) {
      // 건축 대기중 (말뚝 표시)
      ctx.strokeStyle = 'rgba(127, 140, 141, 0.5)'
      ctx.setLineDash([2, 4])
      ctx.strokeRect(x - s / 2, y - s / 2, s, s)
      ctx.setLineDash([])

      ctx.fillStyle = '#8B4513'
      const stakeSize = 3
      ctx.fillRect(x - s / 2 - 1, y - s / 2 - 1, stakeSize, stakeSize)
      ctx.fillRect(x + s / 2 - 2, y - s / 2 - 1, stakeSize, stakeSize)
      ctx.fillRect(x - s / 2 - 1, y + s / 2 - 2, stakeSize, stakeSize)
      ctx.fillRect(x + s / 2 - 2, y + s / 2 - 2, stakeSize, stakeSize)
    }

    // 전용 진행바 렌더링
    RenderUtils.drawBar(ctx, x, y - s / 2 - 10, s, 6, progress, '#34495e', '#f1c40f')

    if (progress <= 0) return

    // 💡 [건축 중] - 비계(Scaffolding) 및 진행 상황 표시
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
      TOWN_HALL: '🏛️', CAMPFIRE: '🔥', HOUSE: '🏠', SCHOOL: '🏫', FARM: '🌾', BARRACKS: '⛺',
      TEMPLE: '⚪', SMITHY: '⚒️', MARKET: '🏪'
    }

    const level = building.level || building.tier || 1
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${iconMap[building.type] || '🏗️'} Lv.${level}`, x, y - s - 10)

    // 💡 [Visual Progress] 레벨에 따라 지붕에 장식 추가 등 디테일 추가 가능
    if (level > 1) {
      ctx.strokeStyle = '#f1c40f'
      ctx.lineWidth = 2
      ctx.strokeRect(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4)
    }
  },

  renderFarmCrops: (building, ctx) => {
    if (!building.crops) return
    const x = building.x, y = building.y
    const cellSize = 8
    const offset = -cellSize * 5

    ctx.save()
    building.crops.forEach(crop => {
      const col = crop.id % 10
      const row = Math.floor(crop.id / 10)
      const cx = x + offset + col * cellSize
      const cy = y + offset + row * cellSize

      ctx.fillStyle = crop.moisture > 30 ? '#5d4037' : '#8d6e63'
      ctx.fillRect(cx, cy, cellSize - 1, cellSize - 1)

      if (crop.status !== 'EMPTY') {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '6px Arial'

        let emoji = '🌱'
        if (crop.status === 'PLANTED') emoji = '🟤'
        if (crop.status === 'RIPE') emoji = '🌾'

        ctx.fillText(emoji, cx + cellSize / 2, cy + cellSize / 2)
      }
    })
    ctx.restore()
  },
}
