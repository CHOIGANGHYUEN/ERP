import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * RETURNING — 무거운 물건을 들고 귀환하는 듯한 무거운 걷기
 */
export const RETURNING = (creature, ctx, timestamp, world) => {
  const f = creature.currentFrame % 5
  const t = timestamp * 0.002 // 무거워서 걷는 속도 느림

  // 5프레임 보행 교차
  const legLFrames = [0, 3, 0, -3, 0]
  const legRFrames = [0, -3, 0, 3, 0]
  const armLFrames = [3, 2, 3, 4, 3] // 팔을 고정하고 무언가를 든 듯한 자세
  const armRFrames = [3, 4, 3, 2, 3]

  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 1.5 // 바운스 약함
  const lean   = Math.sin(t * Math.PI) * 2 // 좌우 흔들림 큼

  drawCreatureBody(creature, ctx, world, timestamp, bounce, {
    legL:     legLFrames[f % 5],
    legR:     legRFrames[f % 5],
    armL:     -4, // 물건 들고 있음
    armR:     -4,
    bodyTilt: 0.1,
    lean,
    blinkPhase: 0
  })
}
