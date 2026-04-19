/**
 * 2D 픽셀 아트 스프라이트 로딩 및 렌더링을 관리하는 전역 매니저 시스템입니다.
 */
export class SpriteManager {
  constructor() {
    this.images = new Map()
    this.sprites = new Map()
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
}
