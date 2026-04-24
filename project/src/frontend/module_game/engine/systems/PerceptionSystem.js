export class PerceptionSystem {
  constructor(di) {
    this.di = di
    this.visionRadius = 256
  }

  update(deltaTime, world) {
    world.creatures.forEach(creature => {
      if (creature.isDead) return

      // 15. 시야 및 인지 반경 제한
      const seenObjects = world.chunkManager.query({
        x: creature.x - this.visionRadius / 2,
        y: creature.y - this.visionRadius / 2,
        width: this.visionRadius,
        height: this.visionRadius
      })

      // 16. 공간 기억 (Spatial Memory) 업데이트
      seenObjects.forEach(obj => {
        if (obj.type === 'resource' && !obj.isDead) {
          this._updateMemory(creature, {
            type: obj.resourceType,
            x: obj.x,
            y: obj.y,
            id: obj.id,
            time: Date.now()
          })
        }
      })

      // 오래된 기억 삭제 (TTL)
      const now = Date.now()
      creature.spatialMemory = creature.spatialMemory.filter(m => now - m.time < 60000)
    })
  }

  _updateMemory(creature, entry) {
    const existingIdx = creature.spatialMemory.findIndex(m => m.id === entry.id)
    if (existingIdx !== -1) {
      creature.spatialMemory[existingIdx] = entry
    } else {
      creature.spatialMemory.push(entry)
      if (creature.spatialMemory.length > 20) creature.spatialMemory.shift()
    }
  }
}
