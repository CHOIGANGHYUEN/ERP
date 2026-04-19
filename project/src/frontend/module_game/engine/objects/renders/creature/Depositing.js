import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * DEPOSITING — 창고에 자원 넣기.
 * 두 팔을 앞으로 뻗어 짐을 내려놓는 동작.
 * 머리 위에 📦 이모지와 짐 내려놓는 파티클을 표시합니다.
 */
export const DEPOSITING = (creature, ctx, timestamp, world) => {
  // 천천히 앞으로 숙이며 내려놓는 동작
  const depositCycle = (Math.sin(timestamp * 0.003) + 1) / 2  // 0~1 완만한 주기
  const leanFwd = depositCycle * 0.18  // 앞으로 숙임 (bodyTilt)
  const armDrop = depositCycle * 6     // 팔을 아래로 내리며 내려놓기

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, 0, {
    // 다리는 넓게 벌려 무게중심 안정
    legL:  2,
    legR: -2,
    // 팔을 앞으로 뻗었다가 내려놓음
    armL: -2 + armDrop,
    armR: -2 + armDrop,
    bodyTilt:  leanFwd,
    blinkPhase: 0.0,
    lean: 0,
  })

  // 머리 위 텍스트
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  // 📦 아이콘 (자원이 있을 때 바운스)
  const iconBounce = Math.abs(Math.sin(timestamp * 0.005)) * 3
  ctx.font = `${Math.max(10, Math.round(drawSize * 0.8))}px Arial`
  ctx.fillText('📦', creature.x, creature.y - drawSize * 1.6 - iconBounce)

  // "저장 중..." 텍스트
  const dots = '.'.repeat(Math.floor((timestamp / 400) % 4))
  ctx.fillStyle = '#f39c12'
  ctx.font = `bold ${Math.max(7, Math.round(drawSize * 0.55))}px Arial`
  ctx.fillText(`저장${dots}`, creature.x, creature.y - drawSize * 2.1)
}
