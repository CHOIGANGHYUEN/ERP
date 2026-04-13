export class RenderUtils {
  static drawShadow(ctx, x, y, size, height = 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(x - size / 2, y + size / 2, size, height)
  }

  static drawBar(ctx, x, y, width, height, progress, bgColor = '#34495e', fgColor = '#2ecc71') {
    ctx.fillStyle = bgColor
    ctx.fillRect(x - width / 2, y, width, height)
    ctx.fillStyle = fgColor
    ctx.fillRect(x - width / 2, y, width * progress, height)
  }
}
