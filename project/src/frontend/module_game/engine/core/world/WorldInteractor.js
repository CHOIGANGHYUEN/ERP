import { PROPS, STRIDE } from '../SharedState.js'

export const WorldInteractor = {
  getEntityAt: (world, screenX, screenY) => {
    if (!world.views) return null

    const zoom = world.camera.zoom || 1
    const worldX = screenX / zoom + world.camera.x
    const worldY = screenY / zoom + world.camera.y

    const range = { x: worldX - 20, y: worldY - 20, width: 40, height: 40 }
    const candidates = world.chunkManager.query(range)

    for (let i = candidates.length - 1; i >= 0; i--) {
      const entity = candidates[i]
      const dist = Math.sqrt(Math.pow(entity.x - worldX, 2) + Math.pow(entity.y - worldY, 2))
      if (dist < (entity.size || 16) + 10) {
        return entity
      }
    }

    const villageCount = world.views.globals[PROPS.GLOBALS.VILLAGE_COUNT]
    for (let i = 0; i < villageCount; i++) {
      const offset = i * STRIDE.VILLAGE
      if (world.views.villages[offset + PROPS.VILLAGE.IS_ACTIVE] === 1) {
        const vx = world.views.villages[offset + PROPS.VILLAGE.X]
        const vy = world.views.villages[offset + PROPS.VILLAGE.Y]
        const vRadius = world.views.villages[offset + PROPS.VILLAGE.RADIUS]
        if (Math.sqrt(Math.pow(vx - worldX, 2) + Math.pow(vy - worldY, 2)) < vRadius) {
          return { _type: 'village', id: i, x: vx, y: vy, size: vRadius }
        }
      }
    }

    return null
  }
}
