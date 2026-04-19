import { ref } from 'vue'

export function useGameCamera(worldInstanceReady, getWorldInstance, gameCanvas) {
  const isClickDrag = ref(false)

  const syncCameraToWorker = () => {
    const worldInstance = getWorldInstance()
    if (worldInstance && worldInstance.onProxyAction) {
      worldInstance.onProxyAction({
        type: 'CAMERA_UPDATE',
        payload: {
          x: worldInstance.camera.x,
          y: worldInstance.camera.y,
          zoom: worldInstance.camera.zoom,
        },
      })
    }
  }

  const handleMouseDown = (e) => {
    const worldInstance = getWorldInstance()
    if (!worldInstance) return
    worldInstance.camera.handleMouseDown(e)
    if (gameCanvas.value) gameCanvas.value.style.cursor = 'grabbing'
    isClickDrag.value = false
  }

  const handleMouseMove = (e) => {
    const worldInstance = getWorldInstance()
    if (!worldInstance || !worldInstance.camera.isDragging) return

    const dx = Math.abs(e.clientX - worldInstance.camera.lastMouseX)
    const dy = Math.abs(e.clientY - worldInstance.camera.lastMouseY)
    if (dx > 3 || dy > 3) {
      isClickDrag.value = true
    }

    worldInstance.camera.handleMouseMove(e)
    syncCameraToWorker()
  }

  const handleMouseUp = (e) => {
    const worldInstance = getWorldInstance()
    if (!worldInstance) return
    worldInstance.camera.handleMouseUp()
    if (gameCanvas.value) gameCanvas.value.style.cursor = 'grab'
  }

  const handleWheel = (e) => {
    const worldInstance = getWorldInstance()
    if (!worldInstance) return
    worldInstance.camera.handleWheel(e)
    syncCameraToWorker()
  }

  return {
    isClickDrag,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    syncCameraToWorker
  }
}
