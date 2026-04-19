import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * 🎨 drawAnimalBody — 프리미엄 유기적 동물 렌더러
 * 
 * 사각형 블록 방식에서 벗어나 곡선과 그라데이션을 활용한 생동감 넘치는 디자인을 구현합니다.
 * 종별 고유 실루엣(늑대, 소, 토끼 등)과 브리딩(Breathing) 애니메이션이 포함됩니다.
 */
export const drawAnimalBody = (animal, ctx, world, timestamp, yOffset = 0, animProps = {}) => {
  const S = animal.size || 16
  const isCarnivore = animal.type === 'CARNIVORE'
  const species = animal.species || (isCarnivore ? 'WOLF' : 'COW')
  
  const {
    legFL = 0, legFR = 0, legBL = 0, legBR = 0,
    tailAngle = 0, bodyTilt = 0, blinkPhase = 0
  } = animProps

  // 1. 수영 상태 감지
  let isSwimming = false
  if (world && world.terrain) {
    const tileSize = 16
    const cols = world.width / tileSize
    const tx = Math.floor(animal.x / tileSize)
    const ty = Math.floor(animal.y / tileSize)
    if (tx >= 0 && tx < cols && ty >= 0 && ty < Math.ceil(world.height / tileSize)) {
      if (world.terrain[ty * cols + tx] >= 3) isSwimming = true
    }
  }

  // 2. 브리딩(Breathing) 효과: 몸이 미세하게 부풀었다 줄었다 함
  const breathing = 1.0 + Math.sin(timestamp * 0.003) * 0.05
  const animY = isSwimming ? S * 0.4 : yOffset

  ctx.save()
  ctx.translate(animal.x, animal.y + animY)
  ctx.rotate(bodyTilt)
  ctx.scale(breathing, breathing)

  const color = animal.color
  const darkColor = RenderUtils?.darken ? RenderUtils.darken(color, 20) : '#333'

  // --- Layer: Legs ---
  if (!isSwimming) {
    ctx.fillStyle = darkColor
    const legW = S * 0.15
    const legH = S * 0.4
    const legY = S * 0.2
    
    // 뒷다리들
    ctx.fillRect(-S * 0.3 + legBL, legY, legW, legH)
    ctx.fillRect(S * 0.1 + legBR, legY, legW, legH)
    // 앞다리들
    ctx.fillStyle = color
    ctx.fillRect(-S * 0.4 + legFL, legY, legW, legH)
    ctx.fillRect(S * 0.2 + legFR, legY, legW, legH)
  }

  // --- Layer: Body ---
  ctx.fillStyle = color
  ctx.beginPath()
  if (species === 'WOLF') {
    // 날카로운 실루엣
    ctx.ellipse(0, 0, S * 0.7, S * 0.4, 0, 0, Math.PI * 2)
  } else if (species === 'COW') {
    // 묵직한 사각형 느낌의 곡선
    ctx.roundRect(-S * 0.6, -S * 0.5, S * 1.2, S * 0.8, S * 0.2)
  } else {
    // 일반적인 뭉툭한 형태 (토끼 등)
    ctx.ellipse(0, 0, S * 0.5, S * 0.4, 0, 0, Math.PI * 2)
  }
  ctx.fill()

  // --- Layer: Head ---
  const headX = S * 0.4
  const headY = -S * 0.2
  ctx.save()
  ctx.translate(headX, headY)
  
  // 얼굴
  ctx.beginPath()
  ctx.arc(0, 0, S * 0.35, 0, Math.PI * 2)
  ctx.fill()

  // 귀 (종별 차별화)
  ctx.fillStyle = darkColor
  if (species === 'WOLF') {
    ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(2, -12); ctx.lineTo(6, -5); ctx.fill() // 뾰족귀
  } else if (species === 'RABBIT') {
    ctx.fillRect(-2, -15, S * 0.15, S * 0.6) // 긴 귀
    ctx.fillRect(2, -15, S * 0.15, S * 0.6)
  } else {
    ctx.arc(-S * 0.2, -S * 0.2, S * 0.1, 0, Math.PI * 2); ctx.fill() // 둥근 귀
  }

  // 눈
  const eyeColor = blinkPhase > 0.9 ? darkColor : '#000'
  ctx.fillStyle = eyeColor
  ctx.beginPath(); ctx.arc(S * 0.15, -S * 0.05, S * 0.05, 0, Math.PI * 2); ctx.fill()
  
  ctx.restore()

  // --- Layer: Tail ---
  ctx.save()
  ctx.translate(-S * 0.5, 0)
  ctx.rotate(tailAngle)
  ctx.strokeStyle = color
  ctx.lineWidth = S * 0.15
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-S * 0.4, S * 0.2); ctx.stroke()
  ctx.restore()

  ctx.restore()
}
