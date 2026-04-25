import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * EATING — 먹는 중.
 * 팔을 들어 입으로 가져가는 동작 + 상하 미세 바운스.
 * 머리 위에 🍽️ 이모지와 배고픔 게이지를 표시합니다.
 */
export const EATING = (creature, ctx, timestamp, world) => {
  const chew = Math.sin(timestamp * 0.01) * 2
  const armBite = -4 + chew

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    legL: 2, legR: 2,
    armL: armBite, armR: armBite,
    bodyTilt: 0.05,
    toolOffset: {
      x: 0,
      y: -2 + chew,
      rotation: 0,
      color: '#e67e22' // 빵(Bread) 색상
    }
  })

  // "냠냠" 텍스트 (페이드 인/아웃)
  ctx.save()
  ctx.globalAlpha = (Math.sin(timestamp * 0.004) + 1) / 2
  ctx.fillStyle = '#2ecc71'
  ctx.font = 'bold 10px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Nyam!', creature.x, creature.y - drawSize * 1.5)
  ctx.restore()
}
