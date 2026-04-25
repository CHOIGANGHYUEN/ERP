/**
 * 2D 픽셀 아트 스프라이트 로딩 및 렌더링을 관리하는 전역 매니저 시스템입니다.
 */
export class SpriteManager {
  constructor() {
    this.images = new Map()
    this.sprites = new Map()
    this.proceduralTextures = new Map() // 절차적으로 생성된 텍스처 보관
    this.compositedCaches = new Map() // 조합된 파츠 캐싱용

    // 초기화 시점에 기본 매터리얼 에셋들을 프로시저럴 코드로 생성해 둡니다.
    this.generateTerrainTiles()
    this.generateParticleTextures()
  }

  // ── [Procedural Generation] 외부 에셋 없이 텍스처 자가 생성 ──────────────────
  ensureCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    return canvas
  }

  generateTerrainTiles() {
    // 타일은 보통 16x16. 여러 종류(Grass, Mountain, Water)를 미리 그려서 등록
    const TS = 16
    const TERRAIN_COLORS = {
      0: { base: '#2ecc71', detail: '#27ae60' }, // GRASS
      1: { base: '#95a5a6', detail: '#7f8c8d' }, // LOW_MOUNTAIN
      2: { base: '#7f8c8d', detail: '#34495e' }, // HIGH_MOUNTAIN
      3: { base: '#3498db', detail: '#2980b9' }, // SHALLOW_SEA
      4: { base: '#2980b9', detail: '#2c3e50' }, // DEEP_SEA
      5: { base: '#1a252f', detail: '#0f1419' }, // ABYSS
    }

    Object.keys(TERRAIN_COLORS).forEach(type => {
      const colors = TERRAIN_COLORS[type]
      const canvas = this.ensureCanvas(TS, TS)
      const ctx = canvas.getContext('2d')
      
      // 베이스 색상
      ctx.fillStyle = colors.base
      ctx.fillRect(0, 0, TS, TS)

      // 노이즈 디테일 (픽셀 아트 스타일)
      ctx.fillStyle = colors.detail
      for (let i = 0; i < 15; i++) {
        const nx = Math.floor(Math.random() * TS)
        const ny = Math.floor(Math.random() * TS)
        ctx.fillRect(nx, ny, 1, 1)
        if (Math.random() > 0.5) ctx.fillRect(nx+1, ny, 1, 1) // 블록화
      }
      
      // 물일 경우 작은 물결 무늬 추가
      if (type >= 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        for (let i = 0; i < 3; i++) {
          const nx = Math.floor(Math.random() * TS)
          const ny = Math.floor(Math.random() * TS)
          ctx.fillRect(nx, ny, 4, 1)
        }
      }

      this.proceduralTextures.set(`terrain_${type}`, canvas)
    })
  }

  generateParticleTextures() {
    const PS = 16
    // 1. 연기 파티클
    let c = this.ensureCanvas(PS, PS); let ctx = c.getContext('2d')
    let grad = ctx.createRadialGradient(PS/2, PS/2, 0, PS/2, PS/2, PS/2)
    grad.addColorStop(0, 'rgba(200, 200, 200, 0.8)')
    grad.addColorStop(1, 'rgba(200, 200, 200, 0)')
    ctx.fillStyle = grad; ctx.fillRect(0,0,PS,PS)
    this.proceduralTextures.set('particle_smoke', c)

    // 2. 불꽃 파티클 (Bloom 효과를 위한 lighter 블렌딩용 텍스처)
    c = this.ensureCanvas(PS, PS); ctx = c.getContext('2d')
    grad = ctx.createRadialGradient(PS/2, PS/2, 0, PS/2, PS/2, PS/2)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.2, 'rgba(255, 200, 50, 0.8)')
    grad.addColorStop(1, 'rgba(255, 50, 0, 0)')
    ctx.fillStyle = grad; ctx.fillRect(0,0,PS,PS)
    this.proceduralTextures.set('particle_fire', c)

    // 3. 마법 파티클
    c = this.ensureCanvas(PS, PS); ctx = c.getContext('2d')
    grad = ctx.createRadialGradient(PS/2, PS/2, 0, PS/2, PS/2, PS/2)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.4, 'rgba(100, 200, 255, 0.8)')
    grad.addColorStop(1, 'rgba(50, 100, 255, 0)')
    ctx.fillStyle = grad; ctx.fillRect(0,0,PS,PS)
    this.proceduralTextures.set('particle_magic', c)
  }

  // 생성해둔 단순 프로시저럴 타일셋 추출
  getProceduralTexture(id) {
    return this.proceduralTextures.get(id)
  }

  /**
   * 이미지 에셋을 비동기로 로드합니다.
   * @param {string} id - 에셋 고유 ID
   * @param {string} src - 이미지 소스 경로
   * @returns {Promise<HTMLImageElement>}
   */
  async loadAsset(id, src) {
    return new Promise((resolve, reject) => {
      if (this.images.has(id)) return resolve(this.images.get(id))
      const img = new Image()
      img.onload = () => {
        this.images.set(id, img)
        resolve(img)
      }
      img.onerror = () => {
        console.error(`[SpriteManager] Failed to load image: ${src}`)
        reject(new Error(`Failed to load image: ${src}`))
      }
      img.src = src
    })
  }

  /**
   * 스프라이트 애니메이션 메타데이터를 등록합니다.
   * @param {string} spriteId - 스프라이트 고유 ID
   * @param {string} imageId - 참조할 이미지 에셋 ID
   * @param {number} frameWidth - 단일 프레임 너비
   * @param {number} frameHeight - 단일 프레임 높이
   * @param {Object} animations - 상태별 애니메이션 정의 (예: { idle: { row: 0, frameCount: 4, speed: 200 } })
   */
  registerSprite(spriteId, imageId, frameWidth, frameHeight, animations = {}) {
    this.sprites.set(spriteId, { imageId, frameWidth, frameHeight, animations })
  }

  render(ctx, spriteId, animationName, x, y, width, height, timestamp, flipX = false) {
    const sprite = this.sprites.get(spriteId)
    if (!sprite) return false

    const img = this.images.get(sprite.imageId)
    if (!img) return false

    const anim = sprite.animations[animationName] || sprite.animations['default']
    if (!anim) return false

    const frameIndex = Math.floor(timestamp / anim.speed) % anim.frameCount
    const sx = frameIndex * sprite.frameWidth
    const sy = anim.row * sprite.frameHeight

    if (flipX) {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(-1, 1)
      ctx.drawImage(
        img,
        sx,
        sy,
        sprite.frameWidth,
        sprite.frameHeight,
        -width / 2,
        -height / 2,
        width,
        height,
      )
      ctx.restore()
    } else {
      // [Optimization] save/restore/translate 대신 직접 좌표 계산하여 호출
      ctx.drawImage(
        img,
        sx,
        sy,
        sprite.frameWidth,
        sprite.frameHeight,
        x - width / 2,
        y - height / 2,
        width,
        height,
      )
    }

    return true
  }

  /**
   * 커스텀 합성 렌더링 (Compositing).
   * 의상, 체형, 색상 등 변형된 파츠를 실시간 캔버스에 합성하여 출력합니다.
   * Caching 전략을 통해 성능 하락을 방지합니다.
   */
  renderComposited(ctx, cacheKey, drawRoutine, x, y, width, height, flipX = false) {
    let texture = this.compositedCaches.get(cacheKey)
    if (!texture) {
       texture = this.ensureCanvas(width || 32, height || 32)
       const tempCtx = texture.getContext('2d')
       // drawRoutine에 위임 (사용측에서 파츠를 조립해서 그림)
       drawRoutine(tempCtx, texture.width, texture.height)
       this.compositedCaches.set(cacheKey, texture)
    }

    if (flipX) {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(-1, 1)
      ctx.drawImage(texture, -width / 2, -height / 2, width, height)
      ctx.restore()
    } else {
      ctx.drawImage(texture, x - width / 2, y - height / 2, width, height)
    }
  }
}
