import { drawCreatureBody } from './drawCreatureBody.js'

/**
 * WANDERING — 8프레임 보행 사이클 도트 애니메이션
 * Layer2: 다리 교차 보행, Layer3: 몸 좌우 기울기, Layer4: 눈 깜빡임
 */
export const WANDERING = (creature, ctx, timestamp, world) => {
  const f = creature.currentFrame        // 0~7 프레임
  const t = timestamp * 0.003

  // 5프레임 보행 사이클: 왼발/오른발 교차
  const legLFrames = [0, 3, 0, -3, 0]
  const legRFrames = [0, -3, 0, 3, 0]
  const armLFrames = [0, -4, 0, 4, 0]
  const armRFrames = [0, 4, 0, -4, 0]

  // 바운스: sin 곡선으로 매끄럽게
  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 2

  // 5% 확률로 눈 깜빡임
  const blinkPhase = (Math.sin(t * 0.7 + creature.id * 2.3) + 1) * 0.5

  const animProps = {
    legL:       legLFrames[f % 5],
    legR:       legRFrames[f % 5],
    armL:       armLFrames[f % 5],
    armR:       armRFrames[f % 5],
    bodyTilt:   Math.sin(t * Math.PI) * 0.04,   // 미세 좌우 흔들림
    blinkPhase,
    lean:       Math.sin(t * Math.PI) * 1.5,    // 좌우 무게 중심 이동
  }
  
  // drawCreatureBody 내부에서 world와 timestamp를 받아 수영 상태를 자동 판별함
  drawCreatureBody(creature, ctx, world, timestamp, bounce, animProps)
}
