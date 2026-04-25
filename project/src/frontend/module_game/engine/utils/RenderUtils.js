export class RenderUtils {
  static drawShadow(ctx, x, y, size, height = 4) {
    const shadowWidth = size * 1.5
    const shadowHeight = height * 2 // 좀 더 부드럽게 퍼지도록
    const grad = ctx.createRadialGradient(x, y + size / 2, 0, x, y + size / 2, shadowWidth / 2)
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.4)')
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.save()
    // 타원형으로 변형 (x축 스케일 > y축 스케일)
    ctx.translate(x, y + size / 2)
    ctx.scale(1, 0.5) // 납작한 타원
    ctx.fillStyle = grad
    ctx.fillRect(-shadowWidth / 2, -shadowHeight, shadowWidth, shadowHeight * 2)
    ctx.restore()
  }

  /**
   * 💡 [후처리] 강한 빛의 확산 효과 (Bloom)
   * 렌더링된 패스나 특정 오브젝트(파티클 등)를 그릴 때 일시적으로 적용합니다.
   */
  static applyBloom(ctx, blurAmount = 4, opacity = 0.5) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.filter = `blur(${blurAmount}px)`
    ctx.globalAlpha = opacity
  }

  /**
   * 필터/합성 상태를 기본값으로 되돌립니다.
   */
  static resetFilters(ctx) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'none'
    ctx.globalAlpha = 1.0
  }

  /**
   * 💡 [후처리] 건물의 Soft Shadow (Drop Shadow) 필터를 적용합니다.
   */
  static applySoftShadow(ctx, offsetX = 5, offsetY = 10, blurCount = 10, color = 'rgba(0,0,0,0.3)') {
    ctx.shadowColor = color
    ctx.shadowBlur = blurCount
    ctx.shadowOffsetX = offsetX
    ctx.shadowOffsetY = offsetY
  }

  /**
   * 💡 [Utility] 단순 픽셀/사각형 드로잉 (이펙트용)
   */
  static drawPixel(ctx, x, y, color = '#ffffff', size = 1) {
    ctx.fillStyle = color
    ctx.fillRect(x - size / 2, y - size / 2, size, size)
  }

  static drawBar(ctx, x, y, width, height, progress, bgColor = '#34495e', fgColor = '#2ecc71') {
    ctx.fillStyle = bgColor
    ctx.fillRect(x - width / 2, y, width, height)
    ctx.fillStyle = fgColor
    ctx.fillRect(x - width / 2, y, width * progress, height)
  }
}
