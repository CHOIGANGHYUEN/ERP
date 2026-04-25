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

  // ■ 8방향 매핑
  const rotation = creature.transform?.rotation ?? creature.rotation ?? (Math.PI / 2)
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

  // 1. 그림자 렌더링
  if (!isSwimming) {
    ctx.save()
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000'; ctx.beginPath()
    const shadowStretch = 1 + bounce * 0.1
    ctx.ellipse(creature.x, creature.y + P, S * 0.4 * shadowStretch, P * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // 💡 [SpriteManager Compositing] 고품질 프로시저럴 파츠 캐싱 및 렌더링
  // 프레임 애니메이션 단계화: 연속적인 값을 이산적인 프레임으로 묶어 캐싱 히트율을 올림
  const frameIndex = Math.floor((legL + legR + armL + armR) / P) // 동작에 따른 보간 프레임 인덱싱
  const isBlink = blinkPhase > 0.93 ? 1 : 0
  const profession = creature.profession || 'NONE'
  
  // 캐시 키: 유니크한 상태의 시그니처 (크기, 방향, 프레임모션, 직업, 나이군, 수영여부)
  const cacheKey = `c_${Math.round(S)}_${faceDir}_${frameIndex}_${profession}_${creature.age >= 60 ? 'old' : 'norm'}_${isSwimming ? 'swim' : 'land'}_${isBlink}`

  // 캔버스 중앙 변환 저장
  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(bodyTilt)
  ctx.scale(1/squash, squash) // 💡 squash/stretch는 이미지를 통째로 트랜스폼 처리해 렌더링 효율 상승

  const renderWidth = S * 1.5
  const renderHeight = S * 1.5

  // world.spriteManager.renderComposited 를 통해 그리기 절차 위임 및 캐싱본 재사용
  if (world && world.spriteManager) {
    world.spriteManager.renderComposited(ctx, cacheKey, (tempCtx, w, h) => {
      // ❗ 이하 로직은 캐시 미니캔버스(tempCtx)에 한 번만 그려집니다.
      const isSide = faceDir === 2 || faceDir === 6

      // 기준 오프셋 (tempCtx의 중앙 하단을 기준으로 그리기)
      const centerX = Math.floor(w / 2)
      const centerY = Math.floor(h / 2) + P * 2

      // Squash 적용되던 bW 등은 SpriteManager가 외부에서 scale 하므로 순수 사이즈로 계산
      let bW = S * 0.7
      if (isSide) bW *= 0.6
      else if (faceDir === 1 || faceDir === 3 || faceDir === 5 || faceDir === 7) bW *= 0.85 
      
      const bH = S * 0.5
      const bX = centerX - bW / 2
      const bY = centerY - S * 0.4

      // 다리(Legs)
      const lW = P * 2, lH = S * 0.5
      let lLX = centerX - P*2, lRX = centerX + P*0.5
      if (isSide) { lLX = centerX - lW/2; lRX = centerX - lW/2 }
      else if (faceDir === 3 || faceDir === 5) { lLX = centerX - P*1.5; lRX = centerX } 
      else if (faceDir === 1 || faceDir === 7) { lLX = centerX - P*1.5; lRX = centerX } 
      
      const pColor = '#2c3e50'
      px(tempCtx, lLX, centerY + legL, lW, lH, pColor)
      if (!isSide) px(tempCtx, lRX, centerY + legR, lW, lH, pColor)

      // 몸통(Body)
      px(tempCtx, bX, bY, bW, bH, outfit.body)
      px(tempCtx, bX + P, bY + P, bW - P*2, P, outfit.detail)

      // 팔(Arms)
      const aS = P * 1.5, aH = S * 0.4
      if (!isSide) {
        px(tempCtx, bX - aS, bY + armL, aS, aH, skin.face)
        px(tempCtx, bX + bW, bY + armR, aS, aH, skin.face)
      } else {
        const sideX = faceDir === 2 ? bX + bW : bX - aS
        px(tempCtx, sideX, bY + armR, aS, aH, skin.face)
      }

      // 머리(Head) & 얼굴(Face)
      const hS = S * 0.7
      const hX = centerX - hS/2, hY = bY - hS + P
      
      px(tempCtx, hX, hY, hS, hS, skin.face)
      px(tempCtx, hX, hY, hS, P*2, skin.hair)
      drawFace(tempCtx, hX, hY, hS, P, faceDir, isBlink, skin.hair)

    }, 0, 0, renderWidth, renderHeight, faceDir === 6 || faceDir === 5 || faceDir === 7) // 서쪽 계열일 경우 flipX 적용
  }

  // 도구(Tool) 렌더링 - 상태에 따라 좌표가 계속 바뀌므로 동적 렌더링 (캐싱에서 제외)
  if (toolOffset) {
    ctx.save()
    ctx.translate(toolOffset.x || 0, toolOffset.y || 0)
    ctx.rotate(toolOffset.rotation || 0)
    
    // 도구 스프라이트 지원
    if (world.spriteManager && world.spriteManager.getProceduralTexture('tool_base')) {
       // 추후 별도 도구 텍스처를 원할 때 연동 (현재는 단일 색상 무기)
    }
    px(ctx, -P, -S*0.4, P*2, S*0.8, toolOffset.color || '#888')
    ctx.restore()
  }

  ctx.restore()

  // 상태 이모지 UI
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

function drawFace(ctx, hX, hY, hS, P, faceDir, isBlink, hairColor) {
  const isBack = faceDir === 0 || faceDir === 1 || faceDir === 7
  if (isBack) {
    px(ctx, hX, hY + P*2, hS, hS - P*2, hairColor)
    return
  }

  const eyeY = hY + hS * 0.4
  ctx.fillStyle = '#1a252f'

  if (faceDir === 2 || faceDir === 6) { // E or W (W is flipped externally)
    if (!isBlink) px(ctx, hX + hS - P*2, eyeY, P, P, '#1a252f')
  } else if (faceDir === 3 || faceDir === 5) { // SE or SW
    if (!isBlink) {
      px(ctx, hX + hS * 0.5, eyeY, P, P, '#1a252f')
      px(ctx, hX + hS - P, eyeY, P, P, '#1a252f')
    }
  } else { // S
    if (!isBlink) {
      px(ctx, hX + P, eyeY, P, P, '#1a252f')
      px(ctx, hX + hS - P*2, eyeY, P, P, '#1a252f')
    }
  }
  
  // 입
  px(ctx, hX + hS*0.3, eyeY + P*3, hS*0.4, P/2, '#c0392b')
}
