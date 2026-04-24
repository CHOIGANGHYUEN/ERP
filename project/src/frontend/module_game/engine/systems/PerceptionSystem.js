export class PerceptionSystem {
  constructor(di) {
    this.di = di
    this.visionRadius = 256
  }

  update(deltaTime, world) {
    world.creatures.forEach(creature => {
      // 💡 [AI 안정성] 죽었거나, 이미 도망 중이거나, 작업에 매우 집중하고 있으면 위협 감지 로직을 건너뜀
      if (creature.isDead || creature.state === 'FLEEING' || ['BUILDING', 'MINING'].includes(creature.state)) return

      // 15. 시야 및 인지 반경 제한
      const seenObjects = world.chunkManager.query({
        x: creature.x - this.visionRadius / 2,
        y: creature.y - this.visionRadius / 2,
        width: this.visionRadius,
        height: this.visionRadius,
      })

      // 💡 [버그 수정] 위협 감지 로직 추가 (기존에는 자원만 인지했음)
      let foundThreat = null
      for (const obj of seenObjects) {
        if (obj.isDead || obj.id === creature.id) continue

        // 1. 육식동물(CARNIVORE)은 위협
        if (obj._type === 'animal' && obj.type === 'CARNIVORE') {
          foundThreat = obj
          break
        }
        // 2. 토네이도는 위협
        if (obj._type === 'tornado') {
          foundThreat = obj
          break
        }
      }

      // 위협을 발견하면 즉시 도망 상태로 전환
      if (foundThreat) {
        creature.state = 'FLEEING'
        const fleeDist = 150 // 도망갈 거리
        const fleeAngle = Math.atan2(creature.y - foundThreat.y, creature.x - foundThreat.x)
        creature.targetX = creature.x + Math.cos(fleeAngle) * fleeDist
        creature.targetY = creature.y + Math.sin(fleeAngle) * fleeDist
        if (!creature.emotions) creature.emotions = {}
        creature.emotions.fear = 100 // 공포심 최대치로 설정
        return // 위협 감지 시 다른 인지 활동 중단
      }

      // 16. 공간 기억 (Spatial Memory) 업데이트
      seenObjects.forEach(obj => {
        if (obj.type === 'resource' && !obj.isDead) {
          this._updateMemory(creature, {
            type: obj.resourceType,
            x: obj.x,
            y: obj.y,
            id: obj.id,
            time: Date.now(),
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
