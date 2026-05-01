import System from '../../core/System.js';
import { AnimalStates } from '../../components/behavior/State.js';

export default class DeathProcessor extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
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
            // 1. 알파값 감소 (페이드아웃 극초가속: 0.1초 소멸)
            if (visual.alpha === undefined) visual.alpha = 1.0;
            visual.alpha = Math.max(0, visual.alpha - dt * 10.0);

            // 2. 소멸 시점에 모든 처리 수행 (메모리 해제 직전)
            if (visual.alpha <= 0) {
                this.handleFinalCleanup(entity, transform);
                em.removeEntity(entity.id);
            }
        } else {
            // 비주얼이 없는 경우 즉시 제거
            this.handleFinalCleanup(entity, transform);
            em.removeEntity(entity.id);
        }
    }

    /**
     * 🧹 엔티티가 소멸하기 직전에 필요한 모든 데이터 처리 및 자원 생성을 수행합니다.
     */
    handleFinalCleanup(entity, transform) {
        if (!transform) return;

        // 1. 비옥도 환원 (죽은 자리가 풍요로워짐)
        if (this.engine.terrainGen) {
            const x = Math.floor(transform.x);
            const y = Math.floor(transform.y);
            const idx = this.engine.terrainGen.getIndex(x, y);

            if (this.engine.terrainGen.isValidIndex(idx)) {
                const fertilityBuffer = this.engine.terrainGen.fertilityBuffer;
                if (fertilityBuffer) {
                    fertilityBuffer[idx] = Math.min(255, fertilityBuffer[idx] + 50);
                    if (this.engine.chunkManager) this.engine.chunkManager.markDirty(x, y);
                }
            }
        }

        // 2. 아이템 드롭 (벌이 아닌 경우에만 고기 생성)
        const animal = entity.components.get('Animal');
        if (animal && animal.type !== 'bee') {
            this.eventBus.emit('SPAWN_ENTITY', { 
                type: 'meat', 
                x: transform.x, 
                y: transform.y 
            });
        }

        // 3. 사회적 스탯 갱신 (벌집 등)
        this.updateHiveStatsOnDeath(entity);

        // 4. 공간 해시 정리
        this.cleanupSpatialHash(entity, transform);

        // 5. 소멸 이벤트 전파
        this.eventBus.emit('ENTITY_DECAYED', { id: entity.id, transform });
    }

    /** 🐝 벌 사망 시 벌집 데이터 갱신 */
    updateHiveStatsOnDeath(entity) {
        const animal = entity.components.get('Animal');
        if (animal && animal.type === 'bee' && animal.hiveId !== undefined) {
            const hive = this.entityManager.entities.get(animal.hiveId);
            if (hive) {
                const hiveComp = hive.components.get('Hive');
                if (hiveComp) {
                    hiveComp.beeCount = Math.max(0, hiveComp.beeCount - 1);
                    if (animal.role === 'queen') hiveComp.hasQueen = false;
                }
            }
        }
    }

    /**
     * 🚀 [Expert Optimization] 소멸되는 개체를 공간 해시에서 즉시 제거
     */
    cleanupSpatialHash(entity, transform) {
        if (!transform || !this.engine.systemManager) return;
        const behavior = this.engine.systemManager.behavior;
        if (behavior && behavior.spatialHash) {
            // Animal은 매 프레임 dynamic이 clear되므로 수동 제거는 주로 리소스용
            const isResource = entity.components.has('Resource');
            behavior.spatialHash.remove(entity.id, transform.x, transform.y, isResource);
        }
    }
}