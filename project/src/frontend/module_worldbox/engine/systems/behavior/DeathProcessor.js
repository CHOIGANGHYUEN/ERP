import System from '../../core/System.js';
import { AnimalStates } from '../../components/behavior/State.js';

export default class DeathProcessor extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        
        // 🏥 [Health Integration] 모든 엔티티의 체력을 검사하여 사망 처리
        for (const [id, entity] of em.entities) {
            const health = entity.components.get('Health');
            if (health && health.currentHp <= 0) {
                this.processDeath(entity, dt);
            }
        }

        // ⏳ [Item Decay] 드랍된 아이템의 소멸 처리
        for (const id of em.resourceIds) {
            const entity = em.entities.get(id);
            const drop = entity?.components.get('DroppedItem');
            if (drop) {
                drop.update(dt);
                if (drop.isDecayed) {
                    this.cleanupSpatialHash(entity, entity.components.get('Transform'));
                    em.removeEntity(id);
                }
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

        // 2. 인벤토리 드롭 (가지고 있던 자원을 월드에 환원)
        const inventory = entity.components.get('Inventory');
        if (inventory && inventory.items) {
            for (const [itemType, count] of Object.entries(inventory.items)) {
                if (count > 0) {
                    // 고기(meat)는 아래에서 별도로 생성하므로 중복 방지
                    if (itemType === 'meat') continue; 
                    
                    for (let i = 0; i < Math.min(5, count); i++) { // 너무 많이 드랍하면 성능 저하되므로 최대 5개 제한
                        this.eventBus.emit('SPAWN_ENTITY', { 
                            type: itemType, 
                            x: transform.x + (Math.random() - 0.5) * 20, 
                            y: transform.y + (Math.random() - 0.5) * 20 
                        });
                    }
                }
            }
        }

        // 3. 📦 [Item Factory Integration] 사망 시 아이템 드랍
        const animal = entity.components.get('Animal');
        const resource = entity.components.get('Resource');
        const building = entity.components.get('Building');
        
        let dropType = null;
        let dropAmount = 1;

        if (animal) {
            const config = this.engine.speciesConfig[animal.type] || {};
            dropType = config.dropItemType || (animal.type === 'bee' ? null : 'meat');
            dropAmount = config.dropAmount || 1;
        } else if (resource) {
            const config = this.engine.resourceBalance[resource.type] || {};
            dropType = config.dropItemType;
            dropAmount = config.dropAmount || 1;
        } else if (building) {
            dropType = 'wood'; // 건물 파괴 시 기본적으로 목재 드랍
            dropAmount = 3;
        }

        if (dropType) {
            const itemFactory = this.engine.factoryProvider.getFactory('item');
            if (itemFactory) {
                itemFactory.spawnDrop(transform.x, transform.y, dropType, dropAmount);
            }
        }

        // 4. [Village Cleanup] 직업 및 마을 할당 해제
        const civ = entity.components.get('Civilization');
        if (civ && civ.villageId !== undefined) {
            this.eventBus.emit('VILLAGER_DEATH', { 
                entityId: entity.id, 
                villageId: civ.villageId,
                jobType: civ.jobType
            });
        }

        // 5. 사회적 스탯 갱신 (벌집 등)
        this.updateHiveStatsOnDeath(entity);

        // 6. 공간 해시 정리
        this.cleanupSpatialHash(entity, transform);

        // 7. 소멸 이벤트 전파
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