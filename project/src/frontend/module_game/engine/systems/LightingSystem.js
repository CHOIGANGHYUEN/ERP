/**
 * 조명 및 셰이더(Shader) 효과 시스템
 * 시간에 따른 동적 그림자 생성 및 계절/날씨별 색조 보정(Color Grading) 필터 처리
 */
export class LightingSystem {
  constructor(worldWidth, worldHeight) {
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight
    // 조명 오버레이 합성을 위한 오프스크린 캔버스 (Worker 환경 DOM 접근 불가 방어코드)
    if (typeof document !== 'undefined') {
      this.lightCanvas = document.createElement('canvas')
      this.lightCtx = this.lightCanvas.getContext('2d')
    } else if (typeof OffscreenCanvas !== 'undefined') {
      this.lightCanvas = new OffscreenCanvas(worldWidth, worldHeight)
      this.lightCtx = this.lightCanvas.getContext('2d')
    }
  }

  /**
   * 시간에 따른 동적 그림자 렌더링
   */
  renderShadows(ctx, entities, timeOfDay) {
    // 시간(0~24000)에 따른 태양의 고도 계산 (6000=오전 6시, 18000=오후 6시)
    let shadowOpacity = 0
    let shadowOffsetX = 0

    if (timeOfDay > 4000 && timeOfDay < 20000) {
      const sunPos = (timeOfDay - 12000) / 6000 // -1 (아침) ~ 0 (정오) ~ 1 (저녁)
      shadowOpacity = 1 - Math.abs(sunPos) * 0.8
      shadowOffsetX = sunPos * 20
    } else {
      return // 밤에는 태양 그림자 없음
    }

    ctx.save()
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity * 0.4})`

    entities.forEach((ent) => {
      if (!ent.size) return
      ctx.beginPath()
      ctx.ellipse(
        ent.x + shadowOffsetX,
        ent.y + ent.size / 2,
        ent.size,
        ent.size / 2,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
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

    if (this.lightCanvas.width !== canvasWidth || this.lightCanvas.height !== canvasHeight) {
      this.lightCanvas.width = canvasWidth
      this.lightCanvas.height = canvasHeight
    }

    const lCtx = this.lightCtx
    lCtx.clearRect(0, 0, canvasWidth, canvasHeight)

    // 1. 시간에 따른 어둠(Darkness) 강도 계산 (0 ~ 24000)
    let darkness = 0
    if (timeOfDay < 5000 || timeOfDay > 19000) {
      darkness = 0.65 // 한밤중
    } else if (timeOfDay >= 5000 && timeOfDay < 7000) {
      darkness = 0.65 * (1 - (timeOfDay - 5000) / 2000) // 새벽 (점점 밝아짐)
    } else if (timeOfDay > 17000 && timeOfDay <= 19000) {
      darkness = 0.65 * ((timeOfDay - 17000) / 2000) // 저녁 (점점 어두워짐)
    }

    // 2. 계절 및 날씨 베이스 틴트 컬러 적용
    let r = 0,
      g = 0,
      b = 0,
      a = darkness
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
      a = Math.max(a, 0.3) // 비오는 날 어두운 푸른 틴트
    }

    lCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
    lCtx.fillRect(0, 0, canvasWidth, canvasHeight)

    // 3. 밤일 경우 광원(Light Source) 펀칭 처리
    if (darkness > 0.1 && drawables && camera) {
      const zoom = camera.zoom || 1
      lCtx.globalCompositeOperation = 'destination-out' // 그려지는 영역의 불투명도를 깎아냄

      drawables.forEach((ent) => {
        // 건물(집) 등 빛을 발산하는 객체 주위 반경을 계산하여 밝혀줌
        if (ent._type === 'building' && ent.isConstructed) {
          const screenX = (ent.x - camera.x) * zoom
          const screenY = (ent.y - camera.y) * zoom
          const radius = (ent.size || 32) * zoom * 2.5

          const grad = lCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius)
          grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
          grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)')
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

          lCtx.fillStyle = grad
          lCtx.beginPath()
          lCtx.arc(screenX, screenY, radius, 0, Math.PI * 2)
          lCtx.fill()
        }
      })
      lCtx.globalCompositeOperation = 'source-over' // 원래대로 복구
    }

    // 최종 완성된 조명/틴트 레이어를 메인 캔버스에 합성
    ctx.save()
    ctx.drawImage(this.lightCanvas, 0, 0)
    ctx.restore()
  }
}
