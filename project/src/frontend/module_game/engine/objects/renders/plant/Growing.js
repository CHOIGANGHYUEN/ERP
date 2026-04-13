export const GROWING = (plant, ctx, timestamp, windSpeed) => {
  const sway = Math.sin(timestamp * 0.003 + plant.x * 0.01) * windSpeed * (plant.size * 0.1)

  if (plant.type === 'tree') {
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(plant.x - plant.size / 6, plant.y - plant.size, plant.size / 3, plant.size)
    ctx.fillStyle = plant.color
    ctx.beginPath()
    ctx.arc(plant.x + sway, plant.y - plant.size, plant.size * 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(
      plant.x + sway - plant.size * 0.4,
      plant.y - plant.size * 0.8,
      plant.size * 0.6,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.beginPath()
    ctx.arc(
      plant.x + sway + plant.size * 0.4,
      plant.y - plant.size * 0.8,
      plant.size * 0.6,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  } else if (plant.type === 'crop') {
    ctx.fillStyle = plant.color
    ctx.fillRect(plant.x - plant.size / 4 + sway, plant.y - plant.size, plant.size / 2, plant.size)
    if (plant.size > plant.maxSize * 0.5) {
      ctx.fillStyle = '#e67e22'
      ctx.fillRect(plant.x - plant.size / 3 + sway, plant.y - plant.size - 4, plant.size * 0.6, 6)
    }
  } else {
    ctx.fillStyle = plant.color
    ctx.beginPath()
    ctx.moveTo(plant.x, plant.y)
    ctx.quadraticCurveTo(
      plant.x + sway * 0.5,
      plant.y - plant.size * 0.5,
      plant.x + sway,
      plant.y - plant.size,
    )
    ctx.quadraticCurveTo(plant.x - 2, plant.y - plant.size * 0.5, plant.x - 3, plant.y)
    ctx.fill()
  }
}
