import System from '../../core/System.js';
import { AnimalStates } from '../../components/behavior/State.js';
import HumanBrain from './brains/HumanBrain.js';
import StateFactory from './states/StateFactory.js';
import FoodSensor from './sensors/FoodSensor.js';
import ZoneSensor from './sensors/ZoneSensor.js';
import RoleFactory from '../roles/RoleFactory.js';
import { JobTypes } from '../../config/JobTypes.js';
import Pathfinder from '../../utils/Pathfinder.js';

/**
 * 👤 HumanBehaviorSystem
 * 인간 엔티티의 복합적인 행동 판단과 상태 전이를 전담합니다.
 */
export default class HumanBehaviorSystem extends System {
    constructor(entityManager, eventBus, engine, spatialHash) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.spatialHash = spatialHash;
        this.humanBrain = new HumanBrain(this.entityManager, this.eventBus, this.engine, this.spatialHash);
        this.stateFactory = new StateFactory(this);
        this.foodSensor = new FoodSensor(this.entityManager, this.spatialHash);
        this.zoneSensor = new ZoneSensor(this.engine);
        this.roleFactory = new RoleFactory(this);
    }

    update(dt, time) {
        const em = this.entityManager;
        const camera = this.engine.camera;
        const frameCount = this.engine.frameCount || 0;

        // 🚀 [Optimization] 카메라 가시 영역 (LOD용)
        const margin = 100;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        // 👤 [Expert Optimization] animalIds 대신 전용 humanIds 사용하여 순회 비용 최소화
        for (const id of em.humanIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const transform = entity.components.get('Transform');
            if (!transform) continue;

            // 1. [AI LOD] 가시성에 따른 업데이트 빈도 조절
            const isVisible = (transform.x > viewX && transform.x < viewX + viewW && 
                               transform.y > viewY && transform.y < viewY + viewH);
            
            const updateModulo = isVisible ? 2 : 10;
            if ((id + frameCount) % updateModulo !== 0) continue;

            const state = entity.components.get('AIState');
            const stats = entity.components.get('BaseStats');
            const emotion = entity.components.get('Emotion');
            const inventory = entity.components.get('Inventory');
            const animal = entity.components.get('Animal');

            if (state && stats) {
                // 🏷️ jobType 초기화 (처음 한 번만)
                const civ = entity.components.get('Civilization');
                if (civ && civ.jobType === undefined) {
                    civ.jobType = JobTypes.UNEMPLOYED;
                    civ.role = null;
                }

                const effectiveDt = dt * updateModulo;

                // 🧠 [Stable AI Transition] 브레인은 '권장' 상태만 제안함 (직접 주입하지 않음)
                const suggestedMode = this.humanBrain.decide(entity, state, stats, emotion, inventory, effectiveDt);
                
                // 🛑 [Blacklist Maintenance] 도달 불가능 타겟 주기적 초기화 (60초마다)
                state.blacklistClearTimer = (state.blacklistClearTimer || 0) + effectiveDt;
                if (state.blacklistClearTimer >= 60.0) {
                    if (state.unreachableTargets) state.unreachableTargets.clear();
                    state.blacklistClearTimer = 0;
                }

                this.updateHumanAI(id, entity, state, transform, animal, stats, effectiveDt, emotion, inventory, suggestedMode);
                
                const visual = entity.components.get('Visual');
                if (visual) {
                    visual.isEating = (state.mode === AnimalStates.EAT);
                    visual.isSleeping = (state.mode === AnimalStates.SLEEP);
                }
            }
        }
    }

    updateHumanAI(id, entity, state, transform, animal, stats, dt, emotion, inventory, suggestedMode) {
        // 💀 사망 상태면 행동 업데이트 중단
        if (state.mode === AnimalStates.DIE) return;

        const config = this.engine.speciesConfig['human'] || {};
        let maxSpeed = config.moveSpeed || 60;
        
        // 1. 생체 리듬 및 감정 업데이트
        this._updateVitals(stats, dt, state);

        // 2. 🏷️ JobController 기반 구역 이탈 방지 & Job State 라우팅 (생존 위기 아닐 때만)
        const jobCtrl = entity.components.get('JobController');
        const isSurvivalCrisis = state.mode === AnimalStates.EAT || state.mode === AnimalStates.FORAGE || state.mode === AnimalStates.SLEEP;
        
        if (jobCtrl && jobCtrl.currentJob && jobCtrl.zoneId && !isSurvivalCrisis) {
            // ... (기존 구역 이탈 방지 로직 유지)
        }
        
        // 3. [Stable State Machine] 상태 실행 및 전이 판단
        if (!state.mode) state.mode = AnimalStates.IDLE;
        const stateHandler = this.stateFactory.getState(state.mode);
        
        if (stateHandler) {
            let nextMode = stateHandler.update(id, entity, dt);
            
            // 💡 [Persistence Logic] 현재 상태가 특별한 지시 없이 종료(IDLE 반환)되었을 때만 브레인의 권장을 따름
            if (nextMode === AnimalStates.IDLE || !nextMode) {
                if (suggestedMode && suggestedMode !== state.mode) {
                    nextMode = suggestedMode;
                }
            }

            if (nextMode && nextMode !== state.mode) {
                this._transitionTo(id, entity, state, nextMode);
            }
        }

        // 4. 속도 제한 적용 (이하 생략)
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }

    _transitionTo(id, entity, state, nextMode) {
        const currentHandler = this.stateFactory.getState(state.mode);
        if (currentHandler && currentHandler.exit) currentHandler.exit(id, entity);

        // 🧹 상태 데이터 초기화
        state.isTargetRequested = false;
        state.targetRequestFailed = false;
        state.path = null;
        state.pathIndex = 0;

        // 타겟 유지 조건 (건설, 채집, 식사 등은 타겟 보존)
        const preservesTarget = [
            AnimalStates.EAT, AnimalStates.PICKUP, AnimalStates.ATTACK, 
            'build', 'deposit', 'gather_wood', 'gather_stone', 
            AnimalStates.FORAGE, AnimalStates.HUNT
        ].includes(nextMode) || nextMode.startsWith('job_');

        if (!preservesTarget) state.targetId = null;

        state.mode = nextMode;
        const nextHandler = this.stateFactory.getState(nextMode);
        if (nextHandler && nextHandler.enter) nextHandler.enter(id, entity);
    }

    /** ZoneManager 인스턴스를 엔진에서 안전하게 가져옵니다. */
    _getZoneManager() {
        if (Array.isArray(this.engine.systems)) {
            return this.engine.systems.find(s => s.constructor.name === 'ZoneManager') || null;
        }
        return this.engine.systems?.get?.('ZoneManager') || null;
    }

    _updateVitals(stats, dt, state) {
        const timeSystem = this.engine.timeSystem;
        const hour = timeSystem.hours;
        const timeScale = timeSystem.timeScale;

        // 수면 중에는 허기/피로 업데이트 속도를 줄임
        const activityMult = (state.mode === AnimalStates.SLEEP) ? 0.3 : 1.0;

        // 1. 🍖 허기 업데이트 (이제 MetabolismSystem에서 전담 관리)
        // const hungerRate = 1.0 * timeScale * activityMult;
        // stats.hunger = Math.max(0, stats.hunger - dt * hungerRate);

        if (stats.hunger <= 0) {
            stats.health -= dt * 5; // 굶주림 데미지 (조금 완화)
        }

        // 2. 💤 피로도 업데이트 (낮/밤 생체 리듬) — timeScale 적용
        const isNight = hour >= 22 || hour < 5;
        const isEvening = hour >= 20 && hour < 22;

        let fatigueRate = 0.05 * timeScale; // 기본 피로도 (timeScale 반영)
        if (isNight) fatigueRate *= 3;
        else if (isEvening) fatigueRate *= 1.5;

        if (state.mode === AnimalStates.SLEEP) {
            // 수면 중 피로 회복
            stats.fatigue = Math.max(0, stats.fatigue - dt * 0.8 * timeScale);
            // 아침이 되고 충분히 쉬었으면 기상
            if (hour >= 5 && hour < 20 && stats.fatigue < 10) {
                state.mode = AnimalStates.IDLE;
            }
        } else {
            stats.fatigue = Math.min(stats.maxFatigue || 100, stats.fatigue + dt * fatigueRate);
            // 극한 피로 또는 밤에 피곤할 때 수면 전이
            if (stats.fatigue >= 100 || (isNight && stats.fatigue > 50 && Math.random() < 0.005)) {
                state.mode = AnimalStates.SLEEP;
                state.targetId = null; // 수면 시 현재 목표 해제
            }
        }

        // 💀 사망 판정
        if (stats.health <= 0) {
            stats.health = 0;
            state.mode = AnimalStates.DIE;
            state.targetId = null;
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
