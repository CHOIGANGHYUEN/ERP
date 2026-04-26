import { drawAnimalBody } from './drawAnimalBody.js'

/**
 * FLEEING — 도망 시의 모션
 * 귀를 뒤로 젖히고, 매우 빠른 속도로 다리를 넓게 벌려 필사적으로 뜁니다.
 */
export const FLEEING = (animal, ctx, timestamp, world) => {
    const f = animal.currentFrame % 5
    const t = timestamp * 0.01 // 이동속도 매우 빠름

    // 뛰는 모션: 보폭을 최대로
    const legFLFrames = [0, 5, 0, -5, 0]
    const legBRFrames = [0, 5, 0, -5, 0]
    const legFRFrames = [0, -5, 0, 5, 0]
    const legBLFrames = [0, -5, 0, 5, 0]

    const bounce = -Math.abs(Math.sin(t * Math.PI)) * 4
    const bodyTilt = 0.2 + Math.sin(t * Math.PI) * 0.1
    const headBob = Math.sin(t * Math.PI * 2) * 3

    const animProps = {
        legFL: legFLFrames[f], legFR: legFRFrames[f],
        legBL: legBLFrames[f], legBR: legBRFrames[f],
        tailAngle: -0.5, // 꼬리 바짝 내림
        bodyTilt,
        blinkPhase: 0,
        earFlat: true, // 귀를 뒤로 젖힘
        headBob,
        stretch: 1.1, // 달릴 때 몸이 최대로 늘어남
        squash: 0.9
    }

    const drawSize = drawAnimalBody(animal, ctx, world, timestamp, bounce, animProps)

    if (Math.sin(t * 5) > 0.5) {
        ctx.font = '10px Arial'
        ctx.fillText('💦', animal.x + (Math.random() - 0.5) * 10, animal.y - drawSize - 5)
    }
}