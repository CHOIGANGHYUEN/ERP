import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * EATING — 먹는 중.
 * 팔을 들어 입으로 가져가는 동작 + 상하 미세 바운스.
 * 머리 위에 🍽️ 이모지와 배고픔 게이지를 표시합니다.
 */
export const EATING = (creature, ctx, timestamp, world) => {
  // 1~2Hz의 빠른 씹기 진동 (좌우 허위 흔들림)
  const chewCycle = Math.sin(timestamp * 0.008) // 씹기 주기
  const bobY      = Math.abs(Math.sin(timestamp * 0.006)) * 2  // 위아래 0~2px 바운스
  const armBite   = -4 + chewCycle * 1.5

  const animProps = {
    legL: 2,
    legR: 2,
    // 양 팔을 위로 들어 음식을 입에 가져가는 동작
    armL: armBite,
    armR: armBite,
    bodyTilt: 0.25 + chewCycle * 0.04,   // 씹으며 미세 몸통 흔들림
    blinkPhase: 0.0,               // 눈은 뜨고 먹는 중
    lean: chewCycle * 0.8,
  }

  const drawSize = drawCreatureBody(creature, ctx, world, timestamp, -bobY, animProps)

  // 머리 위 텍스트
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  // 🍽️ 아이콘
  ctx.font = `${Math.max(10, Math.round(drawSize * 0.8))}px Arial`
  ctx.fillText('🍽️', creature.x, creature.y - drawSize * 1.6)

  // "냠냠" 텍스트 (페이드 인/아웃)
  const textAlpha = (Math.sin(timestamp * 0.004) + 1) / 2
  ctx.globalAlpha = textAlpha
  ctx.fillStyle = '#2ecc71'
  ctx.font = `bold ${Math.max(8, Math.round(drawSize * 0.6))}px Arial`
  ctx.fillText('냠냠', creature.x, creature.y - drawSize * 2.1)
  ctx.globalAlpha = 1.0
}
