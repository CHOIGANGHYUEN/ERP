import System from '../../core/System.js';
import { AnimalStates } from '../../components/behavior/State.js';

export default class DeathProcessor extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        for (const [id, entity] of em.entities) {
            const state = entity.components.get('AIState');
            if (state && state.mode === AnimalStates.DIE) {
                this.processDeath(entity, dt);
            }
        }
    }

    processDeath(entity, dt) {
        const visual = entity.components.get('Visual');
        const transform = entity.components.get('Transform');
        const em = this.entityManager;

        if (visual) {
            // 1. 알파값 감소 (페이드아웃)
            if (visual.alpha === undefined) visual.alpha = 1.0;
            visual.alpha = Math.max(0, visual.alpha - dt * 0.5); // 약 2초간 지속

            // 2. 비옥도 환원 로직
            if (transform && this.engine.terrainGen) {
                const x = Math.floor(transform.x);
                const y = Math.floor(transform.y);
                const width = this.engine.mapWidth;
                const height = this.engine.mapHeight;

                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const idx = y * width + x;
                    const fertilityBuffer = this.engine.terrainGen.fertilityBuffer;

                    if (fertilityBuffer) {
                        const currentFertility = fertilityBuffer[idx];
                        const increment = dt * 10;
                        const finalIncrement = (Math.random() < increment % 1) ? Math.floor(increment) + 1 : Math.floor(increment);

                        if (finalIncrement > 0) {
                            fertilityBuffer[idx] = Math.min(100, currentFertility + finalIncrement);
                        }

                        if (this.engine.chunkManager) {
                            this.engine.chunkManager.markDirty(x, y);
                        }
                    }
                }
            }

            // 3. 완전히 사라지면 엔티티 제거 및 이벤트 전송
            if (visual.alpha <= 0) {
                this.eventBus.emit('ENTITY_DECAYED', { id: entity.id, transform });
                em.removeEntity(entity.id);
            }
        } else {
            this.eventBus.emit('ENTITY_DECAYED', { id: entity.id, transform });
            em.removeEntity(entity.id);
        }
    }
}