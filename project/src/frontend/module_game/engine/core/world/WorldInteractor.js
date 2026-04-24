import { PROPS, STRIDE } from '../SharedState.js'

export const WorldInteractor = {
  getEntityAt: (world, worldX, worldY) => {
    if (!world.views) return null

    const { globalsInt32, sets } = world.views
    const frontIndex = Atomics.load(globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)
    if (frontIndex !== 0 && frontIndex !== 1) return null

    const currentSet = sets[frontIndex]

    // 1. ChunkManager query (Worker/Headless simulation thread)
    const range = { x: worldX - 20, y: worldY - 20, width: 40, height: 40 }
    const candidates = world.chunkManager ? world.chunkManager.query(range) : []

    for (let i = candidates.length - 1; i >= 0; i--) {
      const entity = candidates[i]
      const dist = Math.sqrt(Math.pow(entity.x - worldX, 2) + Math.pow(entity.y - worldY, 2))
      if (dist < (entity.size || 16) + 10) {
        return entity
      }
    }

    // 2. SAB Fallback Scan (Main Thread / UI thread where ChunkManager is empty)
    if (candidates.length === 0) {
      const checkSAB = (typeName, countProp, viewArray, stride) => {
        const count = Atomics.load(globalsInt32, countProp)
        for (let j = 0; j < count; j++) {
          const offset = j * stride
          if (viewArray[offset] === 1) { // IS_ACTIVE
            const tx = viewArray[offset + 1]
            const ty = viewArray[offset + 2]
            const size = viewArray[offset + 3] || 16
            const dist = Math.sqrt(Math.pow(tx - worldX, 2) + Math.pow(ty - worldY, 2))
            if (dist < size + 10) {
              return { _type: typeName, id: j, x: tx, y: ty, size: size }
            }
          }
        }
        return null
      }

      const types = [
        { name: 'creature', countProp: PROPS.GLOBALS.CREATURE_COUNT, view: currentSet.creatures, stride: STRIDE.CREATURE },
        { name: 'building', countProp: PROPS.GLOBALS.BUILDING_COUNT, view: currentSet.buildings, stride: STRIDE.BUILDING },
        { name: 'animal', countProp: PROPS.GLOBALS.ANIMAL_COUNT, view: currentSet.animals, stride: STRIDE.ANIMAL },
        { name: 'mine', countProp: PROPS.GLOBALS.MINE_COUNT, view: currentSet.mines, stride: STRIDE.MINE },
        { name: 'resource', countProp: PROPS.GLOBALS.RESOURCE_COUNT, view: currentSet.resources, stride: STRIDE.RESOURCE },
        { name: 'plant', countProp: PROPS.GLOBALS.PLANT_COUNT, view: currentSet.plants, stride: STRIDE.PLANT },
      ]

      for (const t of types) {
        const found = checkSAB(t.name, t.countProp, t.view, t.stride)
        if (found) return found
      }
    }

    // 3. Village check (Always from SAB)
    const villageCount = Atomics.load(globalsInt32, PROPS.GLOBALS.VILLAGE_COUNT)
    const villageView = currentSet.villages
    for (let i = 0; i < villageCount; i++) {
      const offset = i * STRIDE.VILLAGE
      if (villageView[offset + PROPS.VILLAGE.IS_ACTIVE] === 1) {
        const vx = villageView[offset + PROPS.VILLAGE.X]
        const vy = villageView[offset + PROPS.VILLAGE.Y]
        const vRadius = villageView[offset + PROPS.VILLAGE.RADIUS]
        if (Math.sqrt(Math.pow(vx - worldX, 2) + Math.pow(vy - worldY, 2)) < vRadius) {
          return { _type: 'village', id: i, x: vx, y: vy, size: vRadius }
        }
      }
    }

    return null
  }
}
