import { drawAnimalBody } from './drawAnimalBody.js'
import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * HUNTING — 빠른 돌진 모션 + 크게 벌어지는 다리
 */
export const HUNTING = (animal, ctx, timestamp, world) => {
  const f = animal.currentFrame % 5
  const t = timestamp * 0.005 // 이동속도 빠름

  // 뛰는 모션: 보폭을 크게
  const legFLFrames = [0, 4, 0, -4, 0]
  const legBRFrames = [0, 4, 0, -4, 0]
  const legFRFrames = [0, -4, 0, 4, 0]
  const legBLFrames = [0, -4, 0, 4, 0]

  const bounce = -Math.abs(Math.sin(t * Math.PI)) * 3 // 바운스 강함
  const tailAngle = -0.5 + Math.sin(t * 3) * 0.2 // 꼬리를 치켜듦
  const bodyTilt = 0.2 // 몸을 앞으로 강하게 숙임
  const headBob = Math.sin(t * 5) * 2 // 공격적으로 머리를 흔듦

  const animProps = {
    legFL: legFLFrames[f],
    legFR: legFRFrames[f],
    legBL: legBLFrames[f],
    legBR: legBRFrames[f],
    tailAngle,
    bodyTilt,
    blinkPhase: 0, // 항상 눈을 뜨고 타겟 주시
    headBob,
    stretch: 1.05 // 몸이 앞으로 길어짐
  }

  const drawSize = drawAnimalBody(animal, ctx, world, timestamp, bounce, animProps)

  // Layer 5: 타겟 체력바 및 추적 이펙트
  if (animal.target) {
    RenderUtils.drawBar(
      ctx,
      animal.x - 10 + drawSize / 2,
      animal.y - drawSize - 12,
      20, 3,
      animal.energy / 100, // 타겟 체력이 아니라 본인 에너지로 표시되었던 기존 로직 유지 (사냥 지속력)
      '#e74c3c', '#f1c40f'
    )
    // 분노 이펙트
    ctx.fillStyle = '#c0392b'
    ctx.fillText('💢', animal.x, animal.y - drawSize - 15)
  }
}
