/**
 * 🎨 drawCreatureBody — 5-Layer Pixel Art Renderer (원자적 수정 원칙 준수)
 *
 * Layer 1: Shadow    — 지면 그림자 (깊이감)
 * Layer 2: Limbs     — 다리/팔 도트 픽셀 애니메이션 (4~8프레임 보행 사이클)
 * Layer 3: Body      — 몸통 도트 (직업별 의상 색상 + 도트 디테일)
 * Layer 4: Head      — 머리/얼굴 도트 (눈 깜빡임, 표정 상태)
 * Layer 5: Effect    — 장비/도구 오버레이 (상태별 아이콘, 직업 이펙트)
 */
import { RenderUtils } from '../../../utils/RenderUtils.js'
import { JobIcons } from '../../action/JobIcons.js'

// ─── 픽셀 유틸 ────────────────────────────────────────────────────────────────
const px = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

// 직업별 의상 색상 팔레트
const OUTFIT = {
  NONE:       { body: '#a0a0a0', detail: '#888888', accessory: null },
  GATHERER:   { body: '#27ae60', detail: '#1e8449', accessory: '#f39c12' },
  LUMBERJACK: { body: '#7d3c1a', detail: '#5d2e0e', accessory: '#e67e22' },
  FARMER:     { body: '#f1c40f', detail: '#d4ac0d', accessory: '#27ae60' },
  BUILDER:    { body: '#e67e22', detail: '#c0392b', accessory: '#95a5a6' },
  SCHOLAR:    { body: '#2980b9', detail: '#1f618d', accessory: '#f1c40f' },
  WARRIOR:    { body: '#7f8c8d', detail: '#566573', accessory: '#c0392b' },
  MINER:      { body: '#5d6d7e', detail: '#34495e', accessory: '#f39c12' },
  LEADER:     { body: '#8e44ad', detail: '#6c3483', accessory: '#f1c40f' },
  MERCHANT:   { body: '#f39c12', detail: '#d68910', accessory: '#2ecc71' },
}

// 피부 팔레트 (나이대별)
const SKIN = {
  young:  { face: '#fde3c8', shadow: '#f0c0a0', hair: '#c0392b' },
  adult:  { face: '#f3c29b', shadow: '#d4a77a', hair: '#2c3e50' },
  elder:  { face: '#d4aa88', shadow: '#b8926e', hair: '#bdc3c7' },
}

/**
 * @param {object}  creature
 * @param {CanvasRenderingContext2D} ctx
 * @param {object}  world     — 지형 체크용
 * @param {number}  timestamp — 애니메이션용
 * @param {number}  yOffset   — 수직 바운스 오프셋
 * @param {object}  animProps — { legL, legR, armL, armR, bodyTilt, blinkPhase, lean }
 */
export const drawCreatureBody = (creature, ctx, world, timestamp, yOffset = 0, animProps = {}) => {
  // ── 크기 결정 ──────────────────────────────────────────────────────────────
  let S = creature.size || 16
  if (!creature.isAdult) S *= 0.65
  else if (creature.age >= 60) S *= 0.88

  const P = Math.max(1, Math.round(S / 8)) // 픽셀 단위 (도트 사이즈)

  // 나이대 피부 선택
  const skin = !creature.isAdult ? SKIN.young
    : (creature.age >= 60 ? SKIN.elder : SKIN.adult)

  // 직업 의상
  const outfit = OUTFIT[creature.profession] || OUTFIT.NONE

  const {
    legL = 0, legR = 0, armL = 0, armR = 0,
    bodyTilt = 0, blinkPhase = 0, lean = 0,
  } = animProps

  // ── 수영 상태 감지 및 좌표 보정 ───────────────────────────────────────────
  let isSwimming = false
  if (world && world.terrain) {
    const tileSize = 16
    const cols = world.width / tileSize
    const tx = Math.floor(creature.x / tileSize)
    const ty = Math.floor(creature.y / tileSize)
    if (tx >= 0 && tx < cols && ty >= 0 && ty < Math.ceil(world.height / tileSize)) {
      if (world.terrain[ty * cols + tx] >= 3) isSwimming = true
    }
  }

  const swimOffset = isSwimming ? S * 0.4 : 0
  const bx = creature.x + lean
  const by = creature.y + yOffset + swimOffset

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 1: 그림자 (수영 중에는 물결로 대체)
  if (!isSwimming) {
    const shadowW = S * 0.8
    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(creature.x, creature.y + P, shadowW * 0.55, P * 1.2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1.0
    ctx.restore()
  } else {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = P * 0.5
    ctx.beginPath()
    const rippleScale = 1.0 + Math.sin(timestamp * 0.005) * 0.2
    ctx.ellipse(creature.x, creature.y + P, S * 0.6 * rippleScale, S * 0.3 * rippleScale, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(bodyTilt)

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 2: 다리 (도트 픽셀 보행 사이클)
  // ─────────────────────────────────────────────────────────────────────────
  const legW   = P * 2
  const legH   = S * 0.55
  const legTopY = S * 0.05
  const legLX  = -legW - P
  const legRX  = P

  // 바지/갑옷 색상 (직업에 따라)
  const pantsColor = creature.profession === 'WARRIOR' ? '#4a4a5a' : '#2c3e50'
  const bootColor  = creature.profession === 'WARRIOR' ? '#1a1a2a' : '#1a252f'

  // 왼쪽 다리
  px(ctx, legLX, legTopY + legL, legW, legH - P * 2, pantsColor)
  px(ctx, legLX, legTopY + legL + legH - P * 2, legW, P * 2, bootColor)  // 부츠

  // 오른쪽 다리
  px(ctx, legRX, legTopY + legR, legW, legH - P * 2, pantsColor)
  px(ctx, legRX, legTopY + legR + legH - P * 2, legW, P * 2, bootColor)

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 3: 몸통 (도트 의상)
  // ─────────────────────────────────────────────────────────────────────────
  const bodyW = S * 0.75
  const bodyH = S * 0.55
  const bodyX = -bodyW / 2
  const bodyY = -S * 0.5

  // 몸통 메인
  px(ctx, bodyX, bodyY, bodyW, bodyH, outfit.body)

  // 도트 디테일: 의상 라인
  px(ctx, bodyX + P, bodyY + P, bodyW - P * 2, P, outfit.detail)  // 어깨 라인
  px(ctx, bodyX + bodyW / 2 - P / 2, bodyY + P * 2, P, bodyH - P * 3, outfit.detail)  // 중앙 단추

  // 직업별 의상 특수 디테일
  if (creature.profession === 'WARRIOR') {
    // 갑옷 어깨 패드
    px(ctx, bodyX - P, bodyY, P * 2, P * 2, '#95a5a6')
    px(ctx, bodyX + bodyW - P, bodyY, P * 2, P * 2, '#95a5a6')
  } else if (creature.profession === 'SCHOLAR' || creature.profession === 'LEADER') {
    // 망토 자락
    px(ctx, bodyX - P, bodyY + P * 2, P, bodyH - P * 2, outfit.detail)
    px(ctx, bodyX + bodyW, bodyY + P * 2, P, bodyH - P * 2, outfit.detail)
  } else if (creature.profession === 'MERCHANT') {
    // 조끼 장식
    px(ctx, bodyX + P * 2, bodyY + P, P, bodyH - P * 2, outfit.accessory)
  }

  // 팔 (왼쪽)
  const armW = P * 2
  const armH = S * 0.5
  const armLX = bodyX - armW
  const armRX = bodyX + bodyW

  px(ctx, armLX, bodyY + armL, armW, armH, skin.face)
  px(ctx, armLX, bodyY + armL + armH - P, armW, P, skin.shadow) // 손

  // 팔 (오른쪽)
  px(ctx, armRX, bodyY + armR, armW, armH, skin.face)
  px(ctx, armRX, bodyY + armR + armH - P, armW, P, skin.shadow)

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 4: 머리 (8x8 도트 얼굴)
  // ─────────────────────────────────────────────────────────────────────────
  const headSize = S * 0.7
  const headX = -headSize / 2
  const headY = bodyY - headSize

  // 머리카락/모자 (직업별)
  const hairH = P * 2
  px(ctx, headX, headY, headSize, hairH, skin.hair)

  if (creature.profession === 'LEADER') {
    // 왕관
    px(ctx, headX - P, headY - P * 2, P, P * 2, '#f1c40f')
    px(ctx, headX + headSize / 2 - P / 2, headY - P * 3, P, P * 3, '#f1c40f')
    px(ctx, headX + headSize - P, headY - P * 2, P, P * 2, '#f1c40f')
  } else if (creature.profession === 'MINER') {
    // 헬멧
    px(ctx, headX - P, headY, headSize + P * 2, P * 2, '#f39c12')
  } else if (creature.profession === 'WARRIOR') {
    // 투구 챙
    px(ctx, headX - P, headY, headSize + P * 2, hairH, '#95a5a6')
  }

  // 얼굴 배경
  px(ctx, headX, headY + hairH, headSize, headSize - hairH, skin.face)

  // 눈 (깜빡임 포함)
  const eyeY = headY + headSize * 0.45
  const blink = (blinkPhase > 0.92) // 8% 시간만 눈을 감음
  if (!blink) {
    // 눈동자
    px(ctx, headX + headSize * 0.2, eyeY, P * 1.5, P * 1.5, '#1a252f')
    px(ctx, headX + headSize * 0.6, eyeY, P * 1.5, P * 1.5, '#1a252f')
    // 눈의 흰자 하이라이트
    px(ctx, headX + headSize * 0.2 + P, eyeY, P, P, '#fff')
  } else {
    // 눈 감은 상태 (선)
    px(ctx, headX + headSize * 0.15, eyeY + P * 0.5, P * 2, P * 0.5, '#1a252f')
    px(ctx, headX + headSize * 0.55, eyeY + P * 0.5, P * 2, P * 0.5, '#1a252f')
  }

  // 코
  px(ctx, headX + headSize * 0.45, eyeY + P * 2, P, P, skin.shadow)

  // 입 (배고픔 상태 반영)
  if (creature.needs && creature.needs.hunger > 70) {
    // 슬픈 입
    px(ctx, headX + headSize * 0.25, eyeY + P * 4, P, P, '#c0392b')
    px(ctx, headX + headSize * 0.65, eyeY + P * 4, P, P, '#c0392b')
  } else {
    // 보통 입
    px(ctx, headX + headSize * 0.3, eyeY + P * 4, P * 2, P * 0.8, '#c0392b')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER 5: 이펙트 오버레이 (장비 / 도구 / 상태)
  // ─────────────────────────────────────────────────────────────────────────

  ctx.restore() // 좌표계 복원 후 이펙트는 월드 좌표로

  // 직업 아이콘 (머리 위)
  if (creature.isAdult) {
    ctx.font = `${Math.max(8, P * 4)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const iconY = creature.y + yOffset - S * 1.5 - headSize + lean
    const icon = JobIcons[creature.profession]
    if (icon) {
      ctx.fillText(icon, creature.x + lean, iconY)
    }
  }

  return S // drawSize 반환
}
