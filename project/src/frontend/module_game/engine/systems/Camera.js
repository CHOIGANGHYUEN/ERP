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
    this.zoom = 1
  }

  handleMouseDown(e) {
    this.isDragging = true
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
  }

  handleMouseMove(e) {
    if (!this.isDragging) return

    // CSS 화면 스케일 및 줌 배율에 비례하여 패닝 이동 속도 정밀 조절
    const rect = e.target.getBoundingClientRect()
    const scaleX = this.width / rect.width
    const scaleY = this.height / rect.height

    const dx = ((e.clientX - this.lastMouseX) * scaleX) / this.zoom
    const dy = ((e.clientY - this.lastMouseY) * scaleY) / this.zoom
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY

    this.x -= dx
    this.y -= dy

    this.clamp()
  }

  handleMouseUp() {
    this.isDragging = false
  }

  handleWheel(e) {
    const zoomSensitivity = 0.001
    const delta = -e.deltaY * zoomSensitivity
    let newZoom = this.zoom + delta

    // 0.5배 ~ 3.0배 제한
    newZoom = Math.max(0.5, Math.min(newZoom, 3.0))

    if (newZoom !== this.zoom) {
      const rect = e.target.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left) * (this.width / rect.width)
      const mouseY = (e.clientY - rect.top) * (this.height / rect.height)

      const worldX = mouseX / this.zoom + this.x
      const worldY = mouseY / this.zoom + this.y

      this.zoom = newZoom
      this.x = worldX - mouseX / this.zoom
      this.y = worldY - mouseY / this.zoom

      this.clamp()
    }
  }

  clamp() {
    const viewW = this.width / this.zoom
    const viewH = this.height / this.zoom
    this.x = Math.max(0, Math.min(this.x, this.mapWidth - viewW))
    this.y = Math.max(0, Math.min(this.y, this.mapHeight - viewH))
  }
}
