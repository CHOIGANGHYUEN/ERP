import { drawAnimalBody } from './drawAnimalBody.js'

/**
 * WANDERING — 5프레임 보행 사이클 모션
 * 4족 보행의 대각선 교차 보행 패턴 적용
 */
export const WANDERING = (animal, ctx, timestamp, world) => {
  const f = animal.currentFrame % 5
  const t = timestamp * 0.003
  
  // 5프레임 교차 보행
  const legFLFrames = [0, 3, 0, -3, 0] // 앞왼
  const legBRFrames = [0, 3, 0, -3, 0] // 뒤오른
  
  const legFRFrames = [0, -3, 0, 3, 0] // 앞오른
  const legBLFrames = [0, -3, 0, 3, 0] // 뒤왼

  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 2
  const blinkPhase = (Math.sin(t * 0.5 + animal.id) + 1) * 0.5
  const tailAngle = Math.sin(t * 2) * 0.3

  const animProps = {
    legFL: legFLFrames[f],
    legFR: legFRFrames[f],
    legBL: legBLFrames[f],
    legBR: legBRFrames[f],
    tailAngle,
    bodyTilt: Math.sin(t * Math.PI) * 0.05,
    blinkPhase
  }
  
  // drawAnimalBody 내부에서 world와 timestamp를 받아 수영 상태를 자동 판별함
  drawAnimalBody(animal, ctx, world, timestamp, bounce, animProps)
}
