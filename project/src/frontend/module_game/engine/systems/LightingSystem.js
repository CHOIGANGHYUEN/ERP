/**
 * 조명 및 셰이더(Shader) 효과 시스템
 * 시간에 따른 동적 그림자 생성 및 계절/날씨별 색조 보정(Color Grading) 필터 처리
 */
export class LightingSystem {
  constructor(worldWidth, worldHeight) {
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    // 조명 오버레이 합성을 위한 오프스크린 캔버스 (Worker 환경 DOM 접근 불가 방어코드)
    this.lightCanvas = null
    this.lightCtx = null
    this.shadowTexture = null
    this.lightStamp = null
    this.stars = []
    this.snowAccumulation = 0 // 눈이 쌓인 정도 (0.0 ~ 1.0)
    this.lastTime = Date.now()

    if (typeof document !== 'undefined') {
      this.lightCanvas = document.createElement('canvas')
      this.lightCtx = this.lightCanvas.getContext('2d')

      // [Nuclear Optimization] 그림자 및 조명 텍스처 미리 생성 (Shadow & Light Stamping)
      this._createShadowTexture()
      this._createLightStamp()
      this._createStars()
    }
  }

  _createStars() {
    for (let i = 0; i < 300; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.2 + 0.3,
        twinkleSpeed: Math.random() * 0.002 + 0.001,
        offset: Math.random() * Math.PI * 2
      })
    }
  }

  _createShadowTexture() {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.4, 'rgba(0,0,0,0.6)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    this.shadowTexture = canvas
  }

  _createLightStamp() {
    const size = 256 // 해상도 향상
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // 부드럽고 따뜻한 불빛 확산 그라데이션
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, 'rgba(255, 230, 150, 1.0)')
    grad.addColorStop(0.3, 'rgba(255, 200, 100, 0.6)')
    grad.addColorStop(0.6, 'rgba(255, 150, 50, 0.2)')
    grad.addColorStop(1, 'rgba(255, 100, 0, 0)')

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    this.lightStamp = canvas
  }

  /**
   * 시간에 따른 동적 그림자 렌더링
   */
  renderShadows(ctx, entities, timeOfDay) {
    if (timeOfDay < 4000 || timeOfDay > 20000 || !this.shadowTexture) return

    // 시간(0~24000)에 따른 태양의 고도 및 그림자 길이 계산
    const sunPos = (timeOfDay - 12000) / 6000 // -1 (아침) ~ 0 (정오) ~ 1 (저녁)
    const shadowOpacity = Math.max(0.1, 0.4 * (1 - Math.abs(sunPos) * 0.5))
    const shadowOffsetX = sunPos * 15
    const shadowLength = 1.0 + Math.abs(sunPos) * 1.5 // 저녁엔 그림자가 길어짐

    ctx.save()
    ctx.globalAlpha = shadowOpacity

    entities.forEach((ent) => {
      const s = ent.size || 16
      const sw = s * shadowLength
      const sh = s * 0.3
      const x = ent.x + shadowOffsetX
      const y = ent.y + s / 4

      // 💡 [캔버스 멈춤 방어] 좌표나 크기가 유효하지 않을 때 drawImage가 호출되어 브라우저가 정지하는 현상 방어
      if (sw > 0 && sh > 0 && Number.isFinite(x) && Number.isFinite(y)) {
        ctx.drawImage(this.shadowTexture, x - sw, y - sh, sw * 2, sh * 2)
      }
    })

    ctx.restore()
  }

  /**
   * 계절, 날씨, 낮/밤 시간에 따른 어둠 레이어 렌더링 및 광원(Light Source) 펀칭
   */
  applyColorGrading(
    ctx,
    canvasWidth,
    canvasHeight,
    season,
    weatherType,
    timeOfDay,
    drawables,
    camera,
  ) {
    if (!this.lightCanvas || !this.lightCtx) return

    const now = Date.now()
    const dt = Math.min(now - (this.lastTime || now), 100) // 탭 비활성화 시 폭증 방지
    this.lastTime = now

    // 눈 쌓임 및 녹는 효과 (서서히 증감)
    if (weatherType === 'snow') {
      this.snowAccumulation = Math.min(1.0, this.snowAccumulation + dt * 0.0005) // 약 2초에 걸쳐 서서히 쌓임
    } else {
      this.snowAccumulation = Math.max(0, this.snowAccumulation - dt * 0.00015) // 약 6.5초에 걸쳐 천천히 녹음
    }

    if (this.lightCanvas.width !== canvasWidth || this.lightCanvas.height !== canvasHeight) {
      this.lightCanvas.width = canvasWidth
      this.lightCanvas.height = canvasHeight
    }

    const lCtx = this.lightCtx
    lCtx.clearRect(0, 0, canvasWidth, canvasHeight)

    // 1. 시간에 따른 하늘 색상(Sky Color) 및 어둠(Darkness) 강도 계산
    let darkness = 0, starAlpha = 0
    let baseR = 255, baseG = 255, baseB = 255

    if (timeOfDay >= 0 && timeOfDay < 4000) {
      baseR = 15; baseG = 20; baseB = 40; darkness = 0.85; starAlpha = 1.0
    } else if (timeOfDay >= 4000 && timeOfDay < 6000) {
      const ratio = (timeOfDay - 4000) / 2000 // 새벽 여명
      baseR = 15 + ratio * 240; baseG = 20 + ratio * 200; baseB = 40 + ratio * 215
      darkness = 0.85 - ratio * 0.85; starAlpha = 1.0 - ratio
    } else if (timeOfDay >= 6000 && timeOfDay < 16000) {
      darkness = 0 // 낮
    } else if (timeOfDay >= 16000 && timeOfDay < 19000) {
      const ratio = (timeOfDay - 16000) / 3000 // 저녁 노을
      baseR = 255; baseG = 255 - ratio * 150; baseB = 255 - ratio * 200
      darkness = ratio * 0.6; starAlpha = ratio * 0.8
    } else if (timeOfDay >= 19000 && timeOfDay <= 24000) {
      const ratio = (timeOfDay - 19000) / 5000 // 밤으로 넘어감
      baseR = 255 - ratio * 240; baseG = 105 - ratio * 85; baseB = 55 - ratio * 15
      darkness = 0.6 + ratio * 0.25; starAlpha = 0.8 + ratio * 0.2
    }

    // 2. 계절 및 날씨에 따른 분위기 혼합 (Tinting)
    let r = baseR, g = baseG, b = baseB, a = darkness

    switch (season) {
      case 'SUMMER':
        r = 255
        g = 230
        b = 150
        a = Math.max(a, 0.05)
        break
      case 'AUTUMN':
        r = 255
        g = 150
        b = 50
        a = Math.max(a, 0.08)
        break
      case 'WINTER':
        r = 150
        g = 200
        b = 255
        a = Math.max(a, 0.12)
        break
    }

    if (weatherType === 'rain') {
      r = 30
      g = 40
      b = 60
      a = Math.max(a, 0.3)
    }

    // 💡 눈 내림 및 쌓인 눈 녹는 이펙트 부드러운 전환
    if (this.snowAccumulation > 0) {
      r = r * (1 - this.snowAccumulation) + 230 * this.snowAccumulation
      g = g * (1 - this.snowAccumulation) + 240 * this.snowAccumulation
      b = b * (1 - this.snowAccumulation) + 255 * this.snowAccumulation
      a = Math.max(a, 0.35 * this.snowAccumulation)
    }

    lCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
    lCtx.fillRect(0, 0, canvasWidth, canvasHeight)

    // 3. 밤하늘의 은은한 별빛 렌더링
    if (starAlpha > 0 && (weatherType === 'clear' || weatherType === 'snow')) {
      lCtx.save()
      lCtx.fillStyle = '#ffffff'
      const timeNow = Date.now()
      for (const star of this.stars) {
        const sx = star.x * canvasWidth; const sy = star.y * canvasHeight
        const twinkle = Math.sin(timeNow * star.twinkleSpeed + star.offset) * 0.5 + 0.5
        lCtx.globalAlpha = starAlpha * twinkle * 0.8
        lCtx.beginPath(); lCtx.arc(sx, sy, star.size, 0, Math.PI * 2); lCtx.fill()
      }
      lCtx.restore()
    }

    // 💡 [눈 쌓임 시각 효과] 식물과 건물 위에 하얀 눈(Frost)을 쌓고 서서히 녹입니다.
    if (this.snowAccumulation > 0 && drawables && camera) {
      const zoom = camera.zoom || 1
      lCtx.save()
      lCtx.fillStyle = `rgba(255, 255, 255, ${0.65 * this.snowAccumulation})` // 눈 쌓임 불투명도 서서히 변화

      drawables.forEach(ent => {
        const screenX = (ent.x - camera.x) * zoom
        const screenY = (ent.y - camera.y) * zoom
        const radius = (ent.size || 16) * zoom

        // 화면 밖 컬링
        if (screenX < -50 || screenX > canvasWidth + 50 || screenY < -50 || screenY > canvasHeight + 50) return;

        if (ent._type === 'plant') {
          // 나무 윗부분에 소복하게 쌓인 눈
          lCtx.beginPath()
          lCtx.ellipse(screenX, screenY - radius * 0.4, radius * 0.8, radius * 0.4, 0, 0, Math.PI * 2)
          lCtx.fill()
        } else if (ent._type === 'building') {
          // 건물 지붕 위에 쌓인 눈
          lCtx.beginPath()
          lCtx.roundRect(screenX - radius * 0.8, screenY - radius - 5, radius * 1.6, Math.max(4, radius * 0.3), 4)
          lCtx.fill()
        }
      })
      lCtx.restore()
    }

    // 4. 빛을 내는 객체(건물, 모닥불)의 광원 펀칭 및 글로우 효과
    if (a > 0.1 && drawables && camera && this.lightStamp) {
      const zoom = camera.zoom || 1
      const timeNow = Date.now()

      const renderLights = (mode, alphaMulti) => {
        lCtx.globalCompositeOperation = mode
        drawables.forEach((ent) => {
          if (ent._type === 'building' && ent.isConstructed) {
            const screenX = (ent.x - camera.x) * zoom
            const screenY = (ent.y - camera.y) * zoom
            let radius = (ent.size || 32) * zoom * 2.5

            // 💡 모닥불(CAMPFIRE)은 타닥타닥 일렁이게(Flicker) 연출
            if (ent.type === 'CAMPFIRE') {
              radius *= 1.2 + Math.sin(timeNow * 0.01 + ent.id) * 0.08
            } else {
              radius *= 1.0 + Math.sin(timeNow * 0.005 + ent.id) * 0.02
            }

            // 💡 [캔버스 멈춤 방어]
            if (radius > 0 && Number.isFinite(screenX) && Number.isFinite(screenY)) {
              lCtx.globalAlpha = alphaMulti
              lCtx.drawImage(
                this.lightStamp,
                screenX - radius,
                screenY - radius,
                radius * 2,
                radius * 2,
              )
            }
          }
        })
      }

      // 먼저 어둠을 뚫고(destination-out), 그 자리에 따뜻한 빛(lighter)을 채워 넣음
      renderLights('destination-out', 1.0)
      renderLights('lighter', 0.6)

      lCtx.globalCompositeOperation = 'source-over'
    }

    // 최종 완성된 조명/틴트 레이어를 메인 캔버스에 합성
    ctx.save()
    ctx.drawImage(this.lightCanvas, 0, 0)
    ctx.restore()
  }
}
