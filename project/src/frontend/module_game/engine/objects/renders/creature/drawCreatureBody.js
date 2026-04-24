/**
 * 🎨 drawCreatureBody — High-End 8-Way Directional Pixel Art Renderer
 * 
 * Directions:
 * 0: N (Back), 1: NE, 2: E (Right), 3: SE, 4: S (Front), 5: SW, 6: W (Left), 7: NW
 */
import { JobIcons } from '../../action/JobIcons.js'

const px = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const OUTFIT = {
  NONE:       { body: '#a0a0a0', detail: '#888888' },
  GATHERER:   { body: '#27ae60', detail: '#1e8449' },
  LUMBERJACK: { body: '#7d3c1a', detail: '#5d2e0e' },
  FARMER:     { body: '#f1c40f', detail: '#d4ac0d' },
  BUILDER:    { body: '#e67e22', detail: '#c0392b' },
  SCHOLAR:    { body: '#2980b9', detail: '#1f618d' },
  WARRIOR:    { body: '#7f8c8d', detail: '#566573' },
  MINER:      { body: '#5d6d7e', detail: '#34495e' },
  LEADER:     { body: '#8e44ad', detail: '#6c3483' },
  MERCHANT:   { body: '#f39c12', detail: '#d68910' },
}

const SKIN = {
  young:  { face: '#fde3c8', shadow: '#f0c0a0', hair: '#c0392b' },
  adult:  { face: '#f3c29b', shadow: '#d4a77a', hair: '#2c3e50' },
  elder:  { face: '#d4aa88', shadow: '#b8926e', hair: '#bdc3c7' },
}

export const drawCreatureBody = (creature, ctx, world, timestamp, yOffset = 0, animProps = {}) => {
  let S = creature.size || 16
  if (!creature.isAdult) S *= 0.65
  else if (creature.age >= 60) S *= 0.88

  const P = Math.max(1, Math.round(S / 8))
  const skin = !creature.isAdult ? SKIN.young : (creature.age >= 60 ? SKIN.elder : SKIN.adult)
  const outfit = OUTFIT[creature.profession] || OUTFIT.NONE

  const {
    legL = 0, legR = 0, armL = 0, armR = 0,
    bodyTilt = 0, blinkPhase = 0, lean = 0,
    bounce = 0, squash = 1, stretch = 1,
    toolOffset = null
  } = animProps

  // ■ 8방향 계산 (완벽한 매핑)
  const rotation = creature.rotation ?? creature.transform?.rotation ?? (Math.PI / 2)
  const norm = (rotation + Math.PI * 2) % (Math.PI * 2)
  const dIdx = Math.floor((norm + Math.PI / 8) / (Math.PI / 4)) % 8
  const DIR_MAP = [2, 3, 4, 5, 6, 7, 0, 1] 
  const faceDir = DIR_MAP[dIdx]

  let isSwimming = false
  if (world && world.terrain) {
    const tx = Math.floor(creature.x / 16); const ty = Math.floor(creature.y / 16)
    const cols = Math.ceil((world.width || 3200) / 16)
    if (tx >= 0 && tx < cols && ty >= 0 && ty < 200) {
      if (world.terrain[ty * cols + tx] >= 3) isSwimming = true
    }
  }

  const swimOffset = isSwimming ? S * 0.4 : 0
  const bx = creature.x + lean
  const by = creature.y + yOffset + swimOffset - (bounce * P)

  // 1. 그림자
  if (!isSwimming) {
    ctx.save()
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000'; ctx.beginPath()
    const shadowStretch = 1 + bounce * 0.1
    ctx.ellipse(creature.x, creature.y + P, S * 0.4 * shadowStretch, P * 0.8, 0, 0, Math.PI * 2)
    ctx.fill(); ctx.restore()
  }

  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(bodyTilt)

  // 2. 방향별 매개변수 설정
  const isBack = faceDir === 0 || faceDir === 1 || faceDir === 7
  const isFront = faceDir === 4 || faceDir === 3 || faceDir === 5
  const isSide = faceDir === 2 || faceDir === 6

  // Squash & Stretch 적용
  let bW = S * 0.7 * (1/squash)
  if (isSide) bW *= 0.6
  else if (faceDir === 1 || faceDir === 3 || faceDir === 5 || faceDir === 7) bW *= 0.85 // 대각선
  
  const bH = S * 0.5 * squash
  const bX = -bW / 2, bY = -S * 0.4 * squash

  // 3. 다리 (Legs)
  const lW = P * 2, lH = S * 0.5
  let lLX = -P*2, lRX = P*0.5
  
  if (isSide) { lLX = -lW/2; lRX = -lW/2 }
  else if (faceDir === 3 || faceDir === 5) { lLX = -P*1.5; lRX = 0 } // 대각선 아래
  else if (faceDir === 1 || faceDir === 7) { lLX = -P*1.5; lRX = 0 } // 대각선 위

  const pColor = '#2c3e50'
  px(ctx, lLX, legL, lW, lH, pColor)
  if (!isSide) px(ctx, lRX, legR, lW, lH, pColor)

  // 4. 몸통 (Body)
  px(ctx, bX, bY, bW, bH, outfit.body)
  px(ctx, bX + P, bY + P, bW - P*2, P, outfit.detail)

  // 5. 팔 (Arms)
  const aS = P * 1.5, aH = S * 0.4
  if (!isSide) {
    px(ctx, bX - aS, bY + armL, aS, aH, skin.face)
    px(ctx, bX + bW, bY + armR, aS, aH, skin.face)
  } else {
    const sideX = faceDir === 2 ? bX + bW : bX - aS
    px(ctx, sideX, bY + armR, aS, aH, skin.face)
  }

  // 6. 머리 (Head)
  const hS = S * 0.7
  const hX = -hS/2, hY = bY - hS + P
  
  px(ctx, hX, hY, hS, hS, skin.face)
  px(ctx, hX, hY, hS, P*2, skin.hair)


  // RE-WRITE FACIAL LOGIC FOR SAFETY
  drawFace(ctx, hX, hY, hS, P, faceDir, blinkPhase, skin.hair)

  // 7. 도구 (Tool)
  if (toolOffset) {
    ctx.save()
    ctx.translate(toolOffset.x || 0, toolOffset.y || 0)
    ctx.rotate(toolOffset.rotation || 0)
    px(ctx, -P, -S*0.4, P*2, S*0.8, toolOffset.color || '#888')
    ctx.restore()
  }

  ctx.restore()

  // 8. 상태 표시
  if (creature.isAdult) {
    const STATE_EMOJI = {
      GATHERING: '🎒', HARVESTING: '🌾', MINING: '⚒️', BUILDING: '🔨',
      ATTACKING: '⚔️', RESTING: '💤', EATING: '🍗', FLEEING: '🏃',
      STUDYING: '📖', SUFFERING: '💢', MOVING: '📍', MATING: '❤️'
    }
    const txt = (STATE_EMOJI[creature.state] || '') + (JobIcons[creature.profession] || '')
    if (txt && creature.state !== 'WANDERING' && creature.state !== 'IDLE') {
      ctx.font = `${Math.max(9, P * 4)}px Arial`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'
      ctx.fillText(txt, creature.x, creature.y - S * 1.5)
    }
  }
}

function drawFace(ctx, hX, hY, hS, P, faceDir, blinkPhase, hairColor) {
  const isBack = faceDir === 0 || faceDir === 1 || faceDir === 7
  if (isBack) {
    px(ctx, hX, hY + P*2, hS, hS - P*2, hairColor)
    return
  }

  const eyeY = hY + hS * 0.4
  const blink = blinkPhase > 0.93
  ctx.fillStyle = '#1a252f'

  if (faceDir === 2) { // E
    if (!blink) px(ctx, hX + hS - P*2, eyeY, P, P, '#1a252f')
  } else if (faceDir === 6) { // W
    if (!blink) px(ctx, hX + P, eyeY, P, P, '#1a252f')
  } else if (faceDir === 3) { // SE
    if (!blink) {
      px(ctx, hX + hS * 0.5, eyeY, P, P, '#1a252f')
      px(ctx, hX + hS - P, eyeY, P, P, '#1a252f')
    }
  } else if (faceDir === 5) { // SW
    if (!blink) {
      px(ctx, hX, eyeY, P, P, '#1a252f')
      px(ctx, hX + hS * 0.3, eyeY, P, P, '#1a252f')
    }
  } else { // S, NE, NW (NE/NW are handled by isBack mostly but just in case)
    if (!blink) {
      px(ctx, hX + P, eyeY, P, P, '#1a252f')
      px(ctx, hX + hS - P*2, eyeY, P, P, '#1a252f')
    }
  }
  
  // 입
  px(ctx, hX + hS*0.3, eyeY + P*3, hS*0.4, P/2, '#c0392b')
}
