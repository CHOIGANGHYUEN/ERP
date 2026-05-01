import System from '../../core/System.js';
import { AnimalStates } from '../../components/behavior/State.js';
import HumanBrain from './brains/HumanBrain.js';
import StateFactory from './states/StateFactory.js';
import FoodSensor from './sensors/FoodSensor.js';

/**
 * 👤 HumanBehaviorSystem
 * 인간 엔티티의 복합적인 행동 판단과 상태 전이를 전담합니다.
 */
export default class HumanBehaviorSystem extends System {
    constructor(entityManager, eventBus, engine, spatialHash) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.spatialHash = spatialHash;
        this.humanBrain = new HumanBrain(this.entityManager, this.eventBus, this.engine);
        this.stateFactory = new StateFactory(this);
        this.foodSensor = new FoodSensor(this.entityManager, this.spatialHash);
    }

    update(dt, time) {
        const em = this.entityManager;
        const frameCount = this.engine.frameCount || 0;

        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const animal = entity.components.get('Animal');
            if (!animal || animal.type !== 'human') continue;

            const state = entity.components.get('AIState');
            const transform = entity.components.get('Transform');
            const stats = entity.components.get('BaseStats');
            const emotion = entity.components.get('Emotion');
            const inventory = entity.components.get('Inventory');

            if (state && transform && stats) {
                // AI 틱 최적화
                if ((id + frameCount) % 2 === 0) {
                    // 🧠 인간 전용 두뇌 결정
                    const nextMode = this.humanBrain.decide(entity, state, stats, emotion, inventory);
                    if (nextMode && nextMode !== state.mode) {
                        state.mode = nextMode;
                    }

                    this.updateHumanAI(id, entity, state, transform, animal, stats, dt * 2, emotion, inventory);
                    
                    const visual = entity.components.get('Visual');
                    if (visual) {
                        visual.isEating = (state.mode === AnimalStates.EAT);
                        visual.isSleeping = (state.mode === AnimalStates.SLEEP);
                    }
                }
            }
        }
    }

    updateHumanAI(id, entity, state, transform, animal, stats, dt, emotion, inventory) {
        // 💀 사망 상태면 행동 업데이트 중단
        if (state.mode === AnimalStates.DIE) return;

        const config = this.engine.speciesConfig['human'] || {};
        let maxSpeed = config.moveSpeed || 60;
        
        // 1. 생체 리듬 및 감정 업데이트
        this._updateVitals(stats, dt, state);
        
        // 2. 상태별 핸들러 실행
        const stateHandler = this.stateFactory.getState(state.mode);
        if (stateHandler) {
            const nextMode = stateHandler.update(id, entity, dt);
            if (nextMode && nextMode !== state.mode) {
                if (stateHandler.exit) stateHandler.exit(id, entity);
                state.mode = nextMode;
                const nextHandler = this.stateFactory.getState(nextMode);
                if (nextHandler && nextHandler.enter) nextHandler.enter(id, entity);
            }
        }

        // 3. 속도 제한 적용
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }

    _updateVitals(stats, dt, state) {
        const timeSystem = this.engine.timeSystem;
        const hour = timeSystem.hours;
        const timeScale = timeSystem.timeScale;
        
        // 1. 🍖 허기 업데이트
        const hungerRate = 1.0 * timeScale;
        stats.hunger = Math.max(0, stats.hunger - dt * hungerRate);
        
        if (stats.hunger <= 0) {
            stats.health -= dt * 10;
        }

        // 2. 💤 피로도 업데이트 (낮/밤 생체 리듬)
        const isNight = hour >= 22 || hour < 5;
        const isEvening = hour >= 20 && hour < 22;
        
        let fatigueRate = 0.1; // 기본 피로도 상승률
        if (isNight) fatigueRate *= 3;
        else if (isEvening) fatigueRate *= 1.5;

        if (state.mode === AnimalStates.SLEEP) {
            stats.fatigue = Math.max(0, stats.fatigue - dt * 0.5 * timeScale);
            // 아침이 되고 충분히 쉬었으면 기상
            if (hour >= 5 && hour < 20 && stats.fatigue < 10) {
                state.mode = AnimalStates.IDLE;
            }
        } else {
            stats.fatigue += dt * fatigueRate * timeScale;
            // 극한 피로 또는 밤에 피곤할 때 수면 전이
            if (stats.fatigue >= 100 || (isNight && stats.fatigue > 40 && Math.random() < 0.01)) {
                state.mode = AnimalStates.SLEEP;
            }
        }
        
        // 💀 사망 판정
        if (stats.health <= 0) {
            stats.health = 0;
            state.mode = AnimalStates.DIE;
        }
    }

    // --- 🍽️ 섭취 및 상호작용 관련 헬퍼 메서드 (EatState 연동) ---

    consumePlant(entity, plantEntity) {
        if (!plantEntity) return;
        
        const stats = entity.components.get('BaseStats');
        const plantRes = plantEntity.components.get('Resource');
        
        if (stats && plantRes) {
            const nutrientValue = plantRes.value || 5.0; 
            stats.storedFertility = (stats.storedFertility || 0) + nutrientValue;
            
            // 허기 즉시 일부 회복 (품질 반영)
            stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + nutrientValue * 2);
            stats.digestionQuality = (stats.digestionQuality || 0.5) * 0.5 + (plantRes.value || 0.5) * 0.5;
        }

        // 지형 점유 해제 및 엔티티 제거
        const pt = plantEntity.components.get('Transform');
        if (pt) {
            if (this.engine.terrainGen) {
                this.engine.terrainGen.setOccupancy(pt.x, pt.y, 0);
            }
            if (this.spatialHash) {
                this.spatialHash.remove(plantEntity.id, pt.x, pt.y, true); 
            }
        }

        this.entityManager.removeEntity(plantEntity.id);
    }

    attackAndConsumeAnimal(entity, victimEntity) {
        if (!victimEntity) return;
        // 전투 이벤트 발행 (CombatSystem에서 처리)
        this.eventBus.emit('COMBAT_ATTACK', {
            attacker: entity,
            defender: victimEntity
        });
    }
}
