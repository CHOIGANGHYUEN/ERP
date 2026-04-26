import { RenderUtils } from '../../../utils/RenderUtils.js'

/**
 * 🎨 drawAnimalBody — 프리미엄 유기적 동물 렌더러
 * 
 * 90배 디테일 업그레이드: 관절 분절, 입체 명암, 세밀한 종별 텍스처, 동적 꼬리/코/귀 애니메이션,
 * 동공 하이라이트 및 육식 동물의 Bloody Mouth 이펙트가 완벽하게 통합되었습니다.
 */
export const drawAnimalBody = (animal, ctx, world, timestamp, yOffset = 0, animProps = {}) => {
  const S = animal.size || 16
  const isCarnivore = animal.type === 'CARNIVORE'
  const species = animal.species || (isCarnivore ? 'WOLF' : 'COW')

  const {
    legFL = 0, legFR = 0, legBL = 0, legBR = 0,
    tailAngle = 0, bodyTilt = 0, blinkPhase = 0, headBob = 0,
    squash = 1, stretch = 1,
    earFlat = false // 도망칠 때 귀를 뒤로 젖히는 속성
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

  // 3. 그림자 렌더링 (가짜 3D)
  if (!isSwimming) {
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.beginPath()
    ctx.ellipse(animal.x, animal.y + S * 0.6, S * 1.2 * stretch, S * 0.4 * squash, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.translate(animal.x, animal.y + animY)

  // 방향에 따른 좌우 반전 (이동 방향 또는 타겟의 위치)
  let isFlipped = false
  if (animal.movement && animal.movement.velocity && animal.movement.velocity.x < 0) {
    isFlipped = true
  } else if (animal.targetX !== undefined && animal.targetX < animal.x) {
    isFlipped = true
  }
  if (isFlipped) ctx.scale(-1, 1)

  ctx.rotate(bodyTilt)
  ctx.scale(breathing * stretch, breathing * squash)

  const color = animal.color || '#ffffff'
  const darkColor = RenderUtils?.darken ? RenderUtils.darken(color, 30) : '#555'
  const lightColor = RenderUtils?.lighten ? RenderUtils.lighten(color, 20) : '#fff'

  // 입체감을 위한 그라데이션 브러시 생성
  const bodyGrad = ctx.createLinearGradient(0, -S, 0, S)
  bodyGrad.addColorStop(0, lightColor)
  bodyGrad.addColorStop(0.6, color)
  bodyGrad.addColorStop(1, darkColor)

  // 관절 렌더링 헬퍼
  const drawLeg = (lx, ly, width, length, swing, isBack) => {
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(swing * 0.1)
    ctx.fillStyle = isBack ? darkColor : bodyGrad
    // 허벅지 (Thigh)
    ctx.beginPath(); ctx.roundRect(-width / 2, 0, width, length * 0.6, width / 2); ctx.fill()
    // 종아리 (Calf)
    ctx.translate(0, length * 0.5)
    ctx.rotate(-swing * 0.15) // 무릎 관절 꺾임
    ctx.beginPath(); ctx.roundRect(-width * 0.4, 0, width * 0.8, length * 0.6, width * 0.4); ctx.fill()
    // 발 (Paw/Hoof)
    ctx.fillStyle = ['COW', 'BOAR', 'DEER', 'SHEEP'].includes(species) ? '#2d3436' : (isBack ? darkColor : color)
    ctx.beginPath(); ctx.ellipse(width * 0.2, length * 0.6, width * 0.6, width * 0.4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // --- Layer: Legs ---
  if (!isSwimming) {
    const isThick = ['ELEPHANT', 'MAMMOTH', 'BEAR', 'COW', 'RHINO'].includes(species)
    const legW = isThick ? S * 0.35 : S * 0.2
    const legH = S * 0.6
    const legY = S * 0.1

    // 뒷 레이어 다리
    drawLeg(-S * 0.35, legY, legW, legH, legBL, true)
    drawLeg(S * 0.15, legY, legW, legH, legBR, true)

    // 앞 레이어 다리
    drawLeg(-S * 0.45, legY, legW, legH, legFL, false)
    drawLeg(S * 0.25, legY, legW, legH, legFR, false)
  }

  // --- Layer: Body ---
  ctx.fillStyle = bodyGrad
  ctx.shadowColor = 'rgba(0,0,0,0.1)'
  ctx.shadowBlur = 5
  ctx.beginPath()
  switch (species) {
    case 'RABBIT': ctx.ellipse(0, 0, S * 0.5, S * 0.4, 0, 0, Math.PI * 2); break
    case 'DEER': ctx.ellipse(0, -S * 0.1, S * 0.6, S * 0.35, 0, 0, Math.PI * 2); break
    case 'SHEEP':
      ctx.ellipse(0, 0, S * 0.6, S * 0.5, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 8; i++) {
        ctx.beginPath()
        ctx.arc(Math.cos(i * 0.8) * S * 0.45, Math.sin(i * 0.8) * S * 0.35, S * 0.35, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = bodyGrad
      break
    case 'COW': ctx.roundRect(-S * 0.7, -S * 0.5, S * 1.4, S * 0.9, S * 0.25); break
    case 'BOAR': ctx.ellipse(0, S * 0.1, S * 0.6, S * 0.4, 0, 0, Math.PI * 2); break
    case 'ELEPHANT':
    case 'MAMMOTH': ctx.roundRect(-S * 0.8, -S * 0.7, S * 1.6, S * 1.3, S * 0.4); break
    case 'BEAR': ctx.ellipse(0, -S * 0.1, S * 0.8, S * 0.65, 0, 0, Math.PI * 2); break
    case 'WOLF': ctx.ellipse(0, 0, S * 0.75, S * 0.45, 0, 0, Math.PI * 2); break
    case 'FOX': ctx.ellipse(0, 0, S * 0.6, S * 0.3, 0, 0, Math.PI * 2); break
    case 'TIGER':
    case 'LION': ctx.ellipse(0, -S * 0.1, S * 0.85, S * 0.45, 0, 0, Math.PI * 2); break
    default: ctx.ellipse(0, 0, S * 0.6, S * 0.4, 0, 0, Math.PI * 2); break
  }
  ctx.fill()
  ctx.shadowBlur = 0 // 초기화

  // 바디 무늬 디테일
  if (species === 'MAMMOTH') {
    // 거친 털 묘사
    ctx.strokeStyle = darkColor; ctx.lineWidth = S * 0.05
    for (let i = -5; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(i * S * 0.15, S * 0.2); ctx.lineTo(i * S * 0.15 - S * 0.1, S * 0.7); ctx.stroke()
    }
  } else if (species === 'TIGER') {
    // 호랑이 줄무늬
    ctx.fillStyle = '#1e272e'; ctx.lineCap = 'round'
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.ellipse(i * S * 0.25, -S * 0.1, S * 0.06, S * 0.35, i * 0.1, 0, Math.PI * 2); ctx.fill()
    }
  } else if (species === 'COW') {
    // 얼룩소 무늬
    ctx.fillStyle = '#1e272e'
    ctx.beginPath(); ctx.ellipse(S * 0.2, -S * 0.1, S * 0.25, S * 0.35, Math.PI / 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(-S * 0.35, S * 0.1, S * 0.3, S * 0.25, -Math.PI / 6, 0, Math.PI * 2); ctx.fill()
  } else if (species === 'DEER') {
    // 사슴 등 흰 점
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.arc(-S * 0.3 + i * S * 0.15, -S * 0.3 + (i % 2) * S * 0.1, S * 0.06, 0, Math.PI * 2); ctx.fill()
    }
  } else if (species === 'BOAR') {
    // 멧돼지 등갈기
    ctx.fillStyle = darkColor
    for (let i = -4; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * S * 0.15, -S * 0.3); ctx.lineTo(i * S * 0.15 - S * 0.1, -S * 0.5); ctx.lineTo(i * S * 0.15 + S * 0.1, -S * 0.3); ctx.fill()
    }
  }

  // --- Layer: Head ---
  let headX = S * 0.4, headY = -S * 0.2, headSize = S * 0.35
  if (['ELEPHANT', 'MAMMOTH'].includes(species)) { headX = S * 0.6; headY = -S * 0.3; headSize = S * 0.45 }
  else if (species === 'DEER') { headX = S * 0.5; headY = -S * 0.5; headSize = S * 0.25 }
  else if (species === 'BEAR') { headX = S * 0.5; headY = -S * 0.3; headSize = S * 0.4 }
  else if (species === 'SHEEP') { headX = S * 0.5; headY = -S * 0.1; headSize = S * 0.25 }

  ctx.save()
  ctx.translate(headX, headY + headBob) // 걸음걸이에 맞춘 머리 바운스

  if (species === 'DEER') {
    ctx.fillStyle = bodyGrad; ctx.fillRect(-S * 0.1, 0, S * 0.2, S * 0.6) // 긴 목
  }
  if (species === 'LION') {
    // 입체적인 사자 갈기
    const maneGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, headSize * 1.8)
    maneGrad.addColorStop(0, '#e67e22'); maneGrad.addColorStop(1, '#833471')
    ctx.fillStyle = maneGrad
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.ellipse(Math.cos(i) * headSize * 0.5, Math.sin(i) * headSize * 0.5, headSize * 1.2, headSize * 0.8, i, 0, Math.PI * 2); ctx.fill()
    }
  }

  ctx.fillStyle = species === 'SHEEP' ? darkColor : bodyGrad
  ctx.beginPath(); ctx.arc(0, 0, headSize, 0, Math.PI * 2); ctx.fill() // 얼굴 윤곽

  // 주둥이 (Snout)
  if (['BOAR', 'COW'].includes(species)) {
    ctx.fillStyle = darkColor
    ctx.fillRect(headSize * 0.4, -headSize * 0.25, headSize * 0.5, headSize * 0.5)
    if (species === 'BOAR') {
      ctx.fillStyle = '#ecf0f1'; ctx.beginPath(); ctx.moveTo(headSize * 0.6, headSize * 0.2); ctx.lineTo(headSize * 1.2, -headSize * 0.4); ctx.lineTo(headSize * 0.9, headSize * 0.2); ctx.fill() // 어금니
      ctx.fillStyle = '#ff7675'; ctx.beginPath(); ctx.arc(headSize * 0.9, -headSize * 0.1, headSize * 0.15, 0, Math.PI * 2); ctx.fill()
    }
  } else if (['FOX', 'WOLF'].includes(species)) {
    ctx.fillStyle = bodyGrad
    ctx.beginPath(); ctx.moveTo(headSize * 0.5, -headSize * 0.2); ctx.lineTo(headSize * 1.2, headSize * 0.2); ctx.lineTo(headSize * 0.5, headSize * 0.5); ctx.fill()
    ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(headSize * 1.2, headSize * 0.2, headSize * 0.12, 0, Math.PI * 2); ctx.fill() // 코끝
  } else if (['TIGER', 'LION'].includes(species)) {
    ctx.fillStyle = lightColor
    ctx.beginPath(); ctx.ellipse(headSize * 0.7, headSize * 0.2, headSize * 0.4, headSize * 0.25, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(headSize * 1.0, headSize * 0.1, headSize * 0.15, 0, Math.PI * 2); ctx.fill() // 고양이과 코
  }

  // 귀
  ctx.save()
  ctx.rotate(earFlat ? -Math.PI / 4 : 0) // 귀 젖힘
  ctx.fillStyle = darkColor
  if (species === 'RABBIT') {
    // 토끼 귀 (입체)
    ctx.beginPath(); ctx.ellipse(-2, -S * 0.6, S * 0.15, S * 0.6, -0.1, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(6, -S * 0.6, S * 0.15, S * 0.6, 0.2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ff7675' // 속귀
    ctx.beginPath(); ctx.ellipse(-2, -S * 0.6, S * 0.07, S * 0.4, -0.1, 0, Math.PI * 2); ctx.fill()
  } else if (['ELEPHANT', 'MAMMOTH'].includes(species)) {
    ctx.fillStyle = bodyGrad; ctx.strokeStyle = darkColor; ctx.lineWidth = S * 0.05
    const flap = Math.sin(timestamp * 0.002) * 0.2
    ctx.save(); ctx.rotate(flap); ctx.beginPath(); ctx.ellipse(-headSize * 0.2, headSize * 0.2, headSize * 0.6, headSize * 1.0, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore()
  } else if (['WOLF', 'FOX', 'TIGER'].includes(species)) {
    ctx.beginPath(); ctx.moveTo(-headSize * 0.2, -headSize * 0.5); ctx.lineTo(headSize * 0.1, -headSize * 1.2); ctx.lineTo(headSize * 0.4, -headSize * 0.5); ctx.fill()
  } else if (['BEAR', 'LION', 'SHEEP'].includes(species)) {
    ctx.beginPath(); ctx.arc(0, -headSize * 0.7, headSize * 0.4, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.beginPath(); ctx.arc(-headSize * 0.2, -headSize * 0.5, headSize * 0.3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  // 뿔 / 상아 / 코(코끼리)
  if (species === 'ELEPHANT') {
    const trunkSwing = Math.sin(timestamp * 0.004) * S * 0.3
    ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = S * 0.12
    ctx.beginPath(); ctx.moveTo(headSize * 0.4, headSize * 0.2); ctx.quadraticCurveTo(headSize * 1.2, headSize, headSize * 1.5, headSize * 0.2); ctx.stroke()

    ctx.strokeStyle = darkColor; ctx.lineWidth = S * 0.25; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(headSize * 0.7, headSize * 0.2); ctx.quadraticCurveTo(headSize * 1.2, headSize * 1.5 + trunkSwing, headSize * 0.8, headSize * 2.0 + trunkSwing); ctx.stroke()
    ctx.strokeStyle = bodyGrad; ctx.lineWidth = S * 0.2; ctx.stroke()
  } else if (species === 'MAMMOTH') {
    const trunkSwing = Math.sin(timestamp * 0.004) * S * 0.2
    ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = S * 0.18; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(headSize * 0.5, headSize * 0.2); ctx.bezierCurveTo(headSize * 2.0, headSize * 1.5, headSize * 2.5, -headSize * 1.0, headSize * 1.8, -headSize * 1.5); ctx.stroke()

    ctx.strokeStyle = darkColor; ctx.lineWidth = S * 0.3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(headSize * 0.7, headSize * 0.2); ctx.quadraticCurveTo(headSize * 1.2, headSize * 1.5 + trunkSwing, headSize * 0.8, headSize * 2.0 + trunkSwing); ctx.stroke()
  } else if (species === 'DEER') {
    // 화려한 나뭇가지 뿔
    ctx.strokeStyle = '#d35400'; ctx.lineWidth = S * 0.08; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, -headSize); ctx.lineTo(headSize * 0.5, -headSize * 2.5) // 메인 뿔
    ctx.moveTo(headSize * 0.2, -headSize * 1.5); ctx.lineTo(-headSize * 0.4, -headSize * 2.0) // 가지 1
    ctx.moveTo(headSize * 0.4, -headSize * 2.0); ctx.lineTo(headSize * 0.8, -headSize * 2.8) // 가지 2
    ctx.stroke()
  } else if (species === 'COW') {
    ctx.strokeStyle = '#dfe6e9'; ctx.lineWidth = S * 0.12; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(0, -headSize * 0.5); ctx.quadraticCurveTo(headSize * 0.8, -headSize * 1.0, headSize * 0.6, -headSize * 1.5); ctx.stroke()
  }

  // 눈 및 하이라이트 디테일
  if (blinkPhase <= 0.9) {
    const eyeX = headSize * 0.4; const eyeY = -headSize * 0.1; const eR = headSize * 0.15
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(eyeX, eyeY, eR, 0, Math.PI * 2); ctx.fill()
    // 빛 반사 하이라이트 (초롱초롱한 눈)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX + eR * 0.3, eyeY - eR * 0.3, eR * 0.3, 0, Math.PI * 2); ctx.fill()
  } else {
    // 감은 눈
    ctx.strokeStyle = darkColor; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(headSize * 0.2, -headSize * 0.1); ctx.quadraticCurveTo(headSize * 0.4, 0, headSize * 0.6, -headSize * 0.1); ctx.stroke()
  }

  // 🔴 [Phase 1: Bloody Mouth Effect] 육식 동물의 사냥 성공 피 이펙트
  if (animal.bloodTimer > 0) {
    const bRatio = animal.bloodTimer / 20000 // 1.0 ~ 0.0
    ctx.fillStyle = `rgba(192, 57, 43, ${Math.min(1, bRatio * 1.5)})` // 강렬한 크림슨 레드
    ctx.beginPath()
    // 입가 주변 불규칙한 선혈 자국
    ctx.arc(headSize * 0.8, headSize * 0.3, headSize * 0.3, 0, Math.PI * 2)
    ctx.arc(headSize * 1.0, headSize * 0.4, headSize * 0.2, 0, Math.PI * 2)
    ctx.arc(headSize * 0.6, headSize * 0.5, headSize * 0.25, 0, Math.PI * 2)
    ctx.fill()

    // 방금 사냥했다면 입가에서 뚝뚝 떨어지는 피 묘사
    if (bRatio > 0.6) {
      ctx.fillRect(headSize * 0.8, headSize * 0.5, S * 0.06, S * 0.3)
      ctx.fillRect(headSize * 1.0, headSize * 0.4, S * 0.04, S * 0.2)
    }
  }

  ctx.restore()

  // --- Layer: Tail ---
  ctx.save()
  let tailX = -S * 0.5, tailY = 0
  if (['ELEPHANT', 'MAMMOTH', 'COW'].includes(species)) { tailX = -S * 0.75; tailY = -S * 0.3; }
  else if (['TIGER', 'LION', 'WOLF', 'FOX', 'DEER'].includes(species)) { tailX = -S * 0.7; tailY = -S * 0.1; }

  ctx.translate(tailX, tailY)
  ctx.rotate(tailAngle)

  if (species === 'FOX') {
    // 크고 풍성한 여우 꼬리
    const tailGrad = ctx.createLinearGradient(0, 0, -S * 0.8, S * 0.3)
    tailGrad.addColorStop(0, color); tailGrad.addColorStop(0.7, color); tailGrad.addColorStop(1, '#fff')
    ctx.fillStyle = tailGrad
    ctx.beginPath(); ctx.ellipse(-S * 0.4, S * 0.15, S * 0.5, S * 0.2, Math.PI / 6, 0, Math.PI * 2); ctx.fill()
  } else if (species === 'WOLF') {
    ctx.fillStyle = darkColor
    ctx.beginPath(); ctx.ellipse(-S * 0.3, S * 0.1, S * 0.4, S * 0.15, Math.PI / 6, 0, Math.PI * 2); ctx.fill()
  } else if (['RABBIT', 'BEAR', 'BOAR', 'SHEEP', 'DEER'].includes(species)) {
    ctx.fillStyle = species === 'RABBIT' || species === 'DEER' ? '#ffffff' : bodyGrad
    ctx.beginPath(); ctx.arc(-S * 0.1, 0, S * 0.15, 0, Math.PI * 2); ctx.fill()
  } else if (species === 'LION') {
    ctx.strokeStyle = bodyGrad; ctx.lineWidth = S * 0.12; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-S * 0.2, S * 0.2, -S * 0.4, S * 0.4, -S * 0.6, S * 0.3); ctx.stroke()
    ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(-S * 0.6, S * 0.3, S * 0.15, 0, Math.PI * 2); ctx.fill() // 꼬리 끝 털
  } else {
    // 일반적인 얇은 꼬리
    ctx.strokeStyle = darkColor; ctx.lineWidth = S * 0.12; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-S * 0.2, S * 0.1, -S * 0.4, S * 0.3, -S * 0.5, S * 0.4); ctx.stroke()
  }
  ctx.restore()

  ctx.restore()

  return S * 1.5
}
