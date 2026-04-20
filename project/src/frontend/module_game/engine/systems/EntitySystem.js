import { Logger } from '../utils/Logger.js'

/**
 * 모든 엔티티의 상태 업데이트를 관리하는 시스템.
 * 대규모 개체 상황에서의 부하를 줄이기 위해 스로틀링(Throttling)을 적용합니다.
 */
export class EntitySystem {
  constructor() {
    this.frameTick = 0
  }

  update(deltaTime, world) {
    try {
      // 주민과 동물은 부드러운 이동을 위해 매 프레임 업데이트
      this.safeUpdate(world.creatures, 'Creature', deltaTime, world)
      this.safeUpdate(world.animals, 'Animal', deltaTime, world)

      // 식물, 자원, 광산은 성장이 느리므로 10프레임마다 한 번씩만 업데이트하여 CPU 부하 절감
      if (this.frameTick % 10 === 0) {
        this.safeUpdate(world.plants, 'Plant', deltaTime * 10, world)
        this.safeUpdate(world.resources, 'Resource', deltaTime * 10, world)
        this.safeUpdate(world.mines, 'Mine', deltaTime * 10, world)
      }

      this.frameTick = (this.frameTick + 1) % 60
    } catch (error) {
      Logger.error('EntitySystem', `엔티티 통합 업데이트 중 치명적 오류: ${error.message}`, error)
    }
  }

  safeUpdate(entities, tag, deltaTime, world) {
    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i]
      if (!entity || entity.isDead) continue

      try {
        entity.update(deltaTime, world)
      } catch (error) {
        Logger.error(tag, `개체(ID: ${entity.id}) 업데이트 중 오류 발생: ${error.message}`, error)
        if (entity.die) entity.die(world)
      }
    }
  }
}
