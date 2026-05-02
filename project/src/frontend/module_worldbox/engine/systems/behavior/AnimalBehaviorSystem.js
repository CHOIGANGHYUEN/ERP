import System from '../../core/System.js';
import SpatialHash from '../../utils/SpatialHash.js';
import { AnimalStates, DietType } from '../../components/behavior/State.js';
import FoodSensor from './sensors/FoodSensor.js';
import BeeBrain from './brains/BeeBrain.js';
import CarnivoreBrain from './brains/CarnivoreBrain.js';
import HerbivoreBrain from './brains/HerbivoreBrain.js';
import StateFactory from './states/StateFactory.js';

export default class AnimalBehaviorSystem extends System {
    constructor(entityManager, eventBus, engine, spatialHash) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.spatialHash = spatialHash;

        // 상태 인스턴스 생성을 StateFactory로 위임
        this.stateFactory = new StateFactory(this);
        this.foodSensor = new FoodSensor(this.entityManager, this.spatialHash);
        this.beeBrain = new BeeBrain(this.entityManager, this.eventBus, this.engine, this.spatialHash);
        
        // 🧠 New Specialized Brains
        this.carnivoreBrain = new CarnivoreBrain(this.entityManager, this.eventBus, this.engine, this.spatialHash);
        this.herbivoreBrain = new HerbivoreBrain(this.entityManager, this.eventBus, this.engine, this.spatialHash);
    }

    update(dt, time) {
        const em = this.entityManager;
        const frameCount = this.engine.frameCount || 0;

        // 1. 공간 해시맵 동적 갱신
        this.spatialHash.clearDynamic();
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (entity) {
                const transform = entity.components.get('Transform');
                if (transform) {
                    this.spatialHash.insert(id, transform.x, transform.y, false);
                }
            }
        }
        
        if (frameCount % 100 === 0) {
            this.refreshStaticHash();
        }

        // 2. 각 엔티티별 AI 상태 업데이트
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const state = entity.components.get('AIState');
            const transform = entity.components.get('Transform');
            const animal = entity.components.get('Animal');
            const stats = entity.components.get('BaseStats');

            if (state && transform && animal) {
                if ((id + frameCount) % 2 === 0) {
                    if (animal.type === 'bee') {
                        this.beeBrain.update(id, state, transform, animal, dt * 2); 
                    } else if (animal.type !== 'human') {
                        // 🥩 [Brain Assignment] 식성에 따라 전용 두뇌 할당
                        if (animal.diet === 'carnivore') {
                            this.carnivoreBrain.update(id, state, transform, animal, stats, dt * 2);
                        } else {
                            this.herbivoreBrain.update(id, state, transform, animal, stats, dt * 2);
                        }
                        
                        // 공통 상태 실행
                        this.updateEntityAI(id, entity, state, transform, animal, stats, dt * 2);
                    }

                    const visual = entity.components.get('Visual');
                    if (visual) {
                        visual.isEating = (state.mode === AnimalStates.EAT);
                        visual.isSleeping = (state.mode === AnimalStates.SLEEP);
                    }
                }
            }
        }
    }

    refreshStaticHash() {
        const em = this.entityManager;
        this.spatialHash.clearAll();

        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            const transform = entity?.components.get('Transform');
            if (transform) this.spatialHash.insert(id, transform.x, transform.y, false);
        }

        for (const id of em.resourceIds) {
            const entity = em.entities.get(id);
            const transform = entity?.components.get('Transform');
            if (transform) this.spatialHash.insert(id, transform.x, transform.y, true);
        }

        for (const id of em.buildingIds) {
            const entity = em.entities.get(id);
            const transform = entity?.components.get('Transform');
            if (transform) this.spatialHash.insert(id, transform.x, transform.y, true);
        }
    }

    updateEntityAI(id, entity, state, transform, animal, stats, dt) {
        // [Note] Metabolism is now handled by MetabolismSystem.js
        if (!state.mode) state.mode = AnimalStates.IDLE;

        // 💀 Death Check
        if (stats && stats.health <= 0) {
            state.mode = AnimalStates.DIE;
            return;
        }

        // Execute current state logic via Factory (HumanBehaviorSystem과 동일한 패턴으로 통일)
        const stateHandler = this.stateFactory.getState(state.mode);
        if (stateHandler) {
            const nextMode = stateHandler.update(id, entity, dt);
            if (nextMode && nextMode !== state.mode) {
                if (stateHandler.exit) stateHandler.exit(id, entity);
                
                // 🧹 상태 전이 시 타겟 및 경로 초기화 (안정성 확보)
                state.targetId = null;
                state.isTargetRequested = false;
                state.targetRequestFailed = false;
                state.path = null;
                state.pathIndex = 0;
                
                state.mode = nextMode;
                const nextHandler = this.stateFactory.getState(nextMode);
                if (nextHandler && nextHandler.enter) nextHandler.enter(id, entity);
            }
        }
    }

    // --- 🍽️ Interaction Helpers ---

    consumePlant(entity, plantEntity) {
        if (!plantEntity) return;
        const stats = entity.components.get('BaseStats');
        const plantRes = plantEntity.components.get('Resource');
        
        if (stats && plantRes) {
            const nutrientValue = plantRes.value || 5.0; 
            stats.storedFertility = (stats.storedFertility || 0) + nutrientValue;
            stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + nutrientValue * 2);
            stats.digestionQuality = (stats.digestionQuality || 0.5) * 0.5 + (plantRes.value || 0.5) * 0.5;
        }

        const pt = plantEntity.components.get('Transform');
        if (pt) {
            if (this.engine.terrainGen) this.engine.terrainGen.setOccupancy(pt.x, pt.y, 0);
            if (this.spatialHash) this.spatialHash.remove(plantEntity.id, pt.x, pt.y, true); 
        }

        this.entityManager.removeEntity(plantEntity.id);
    }

    attackAndConsumeAnimal(entity, victimEntity) {
        if (!victimEntity) return;
        this.eventBus.emit('COMBAT_ATTACK', {
            attacker: entity,
            defender: victimEntity
        });
    }
}
