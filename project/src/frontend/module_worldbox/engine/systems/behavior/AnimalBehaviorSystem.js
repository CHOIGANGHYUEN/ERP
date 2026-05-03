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

        // 🚀 [Optimization] 동적 해시 갱신 로직이 KinematicSystem으로 통합됨 (중복 제거)
        
        if (frameCount % 100 === 0) {
            this.refreshStaticHash();
        }

        const camera = this.engine.camera;
        const viewW = (this.engine.width / (camera.zoom || 1)) + 100;
        const viewH = (this.engine.height / (camera.zoom || 1)) + 100;
        const viewX = camera.x - 50;
        const viewY = camera.y - 50;

        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const state = entity.components.get('AIState');
            const transform = entity.components.get('Transform');
            const animal = entity.components.get('Animal');
            const stats = entity.components.get('BaseStats');

            if (state && transform && animal) {
                const isVisible = transform.x >= viewX && transform.x <= viewX + viewW &&
                                  transform.y >= viewY && transform.y <= viewY + viewH;
                
                const updateModulo = isVisible ? 2 : 10;
                if ((id + frameCount) % updateModulo === 0) {
                    const effectiveDt = dt * updateModulo;

                    if (animal.type === 'bee') {
                        this.beeBrain.update(id, state, transform, animal, effectiveDt); 
                    } else if (animal.type !== 'human') {
                        // 🥩 [Brain Assignment] 식성에 따라 전용 두뇌 할당
                        if (animal.diet === 'carnivore') {
                            this.carnivoreBrain.update(id, state, transform, animal, stats, effectiveDt);
                        } else {
                            this.herbivoreBrain.update(id, state, transform, animal, stats, effectiveDt);
                        }
                        
                        // 공통 상태 실행
                        this.updateEntityAI(id, entity, state, transform, animal, stats, effectiveDt);
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
                
                // 🧹 상태 전이 시 경로 데이터 초기화
                state.isTargetRequested = false;
                state.targetRequestFailed = false;
                state.path = null;
                state.pathIndex = 0;
                
                // [고도화] EAT, PICKUP, ATTACK 등 타겟이 유지되어야 하는 상태가 아니면 타겟 초기화
                const preservesTarget = [
                    AnimalStates.EAT, 
                    AnimalStates.PICKUP, 
                    AnimalStates.ATTACK, 
                    AnimalStates.FORAGE, 
                    AnimalStates.HUNT,
                    AnimalStates.GRAZE
                ].includes(nextMode);
                
                if (!preservesTarget) {
                    state.targetId = null;
                }
                
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
            const nutrientValue = plantRes.value || 10.0; // 기본 영양가 상향
            stats.storedFertility = (stats.storedFertility || 0) + nutrientValue;
            // 🥗 [Balance Fix] 식사 효율 2.5배 상향 (영양가 * 5)
            stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + nutrientValue * 5.0);
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
        // 🍖 [Expert Solution] 사냥꾼(entity)의 ID를 함께 전달하여, 
        // CombatSystem이 사냥 성공 시 사냥꾼에게 고기 ID를 넘겨줄 수 있게 함
        this.eventBus.emit('COMBAT_ATTACK', {
            attacker: entity,
            defender: victimEntity,
            isPredation: true // 포식 행위임을 명시
        });
    }
}
