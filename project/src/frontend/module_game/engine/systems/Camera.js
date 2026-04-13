export class Camera {
  constructor(canvasWidth, canvasHeight, mapWidth, mapHeight) {
    this.x = mapWidth / 2 - canvasWidth / 2
    this.y = mapHeight / 2 - canvasHeight / 2
    this.width = canvasWidth
    this.height = canvasHeight
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
    this.isDragging = false
    this.lastMouseX = 0
    this.lastMouseY = 0
  }

  handleMouseDown(e) {
    this.isDragging = true
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
  }

  handleMouseMove(e) {
    if (!this.isDragging) return
    const dx = e.clientX - this.lastMouseX
    const dy = e.clientY - this.lastMouseY
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
    
    this.x -= dx
    this.y -= dy
    
    this.clamp()
  }

  handleMouseUp() {
    this.isDragging = false
  }

  clamp() {
    this.x = Math.max(0, Math.min(this.x, this.mapWidth - this.width))
    this.y = Math.max(0, Math.min(this.y, this.mapHeight - this.height))
  }
}
