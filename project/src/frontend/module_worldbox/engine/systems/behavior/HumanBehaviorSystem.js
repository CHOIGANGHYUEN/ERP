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
                // 🏷️ jobType 초기화 (처음 한 번만)
                const civ = entity.components.get('Civilization');
                if (civ && civ.jobType === undefined) {
                    civ.jobType = JobTypes.UNEMPLOYED;
                    civ.role = null;
                }

                // AI 틱 최적화
                if ((id + frameCount) % 2 === 0) {
                    // 🧠 HumanBrain이 개체의 생존과 직업(Role)을 총괄하여 최종 행동(State) 판단
                    const nextMode = this.humanBrain.decide(entity, state, stats, emotion, inventory, dt * 2);
                    
                    // 🛑 [Blacklist Maintenance] 도달 불가능 타겟 주기적 초기화 (60초마다)
                    state.blacklistClearTimer = (state.blacklistClearTimer || 0) + dt * 2;
                    if (state.blacklistClearTimer >= 60.0) {
                        if (state.unreachableTargets) state.unreachableTargets.clear();
                        state.blacklistClearTimer = 0;
                    }

                    if (nextMode && nextMode !== state.mode) {
                        // 🧹 상태 전이 시 기존 타겟 및 경로 데이터 초기화 (신규 타겟 재지정 유도)
                        state.targetId = null;
                        state.isTargetRequested = false;
                        state.targetRequestFailed = false;
                        state.path = null;
                        state.pathIndex = 0;
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

        // 2. 🏷️ JobController 기반 구역 이탈 방지 & Job State 라우팅
        const jobCtrl = entity.components.get('JobController');
        if (jobCtrl && jobCtrl.currentJob && jobCtrl.zoneId) {
            const zoneManager = this._getZoneManager();
            const zone = zoneManager?.getZone(jobCtrl.zoneId);

            // [Edge Case] 개체가 구역 밖으로 밀려났을 때 우선 복귀
            if (zone && !zone.contains(transform.x, transform.y)) {
                // 생존 위기 상황(허기 등)이 아니면 구역으로 강제 복귀
                const isInSurvivalMode = state.mode === AnimalStates.EAT ||
                    state.mode === AnimalStates.FORAGE ||
                    state.mode === AnimalStates.SLEEP;
                if (!isInSurvivalMode) {
                    state.returnToZonePath = Pathfinder.findPathToZone(
                        transform.x, transform.y, zone.bounds, this.engine
                    );
                    if (state.returnToZonePath?.length > 0) {
                        Pathfinder.followPath(transform, state, state.returnToZonePath[state.returnToZonePath.length - 1], maxSpeed, this.engine);
                        return; // 이탈 복귀 중 — 다른 상태 처리 건너뜀
                    }
                }
            }

            // [Job Routing] 직업이 있고 생존 위기가 아닐 때 Job State 우선 실행
            const isJobBlocked = state.mode === AnimalStates.EAT ||
                state.mode === AnimalStates.FORAGE ||
                state.mode === AnimalStates.SLEEP ||
                state.mode === AnimalStates.DIE;
            if (!isJobBlocked) {
                const jobStateKey = `job_${jobCtrl.currentJob}`;
                const jobStateHandler = this.stateFactory.getState(jobStateKey);
                if (jobStateHandler) {
                    const nextMode = jobStateHandler.update(id, entity, dt);
                    if (nextMode && nextMode !== jobStateKey) {
                        if (jobStateHandler.exit) jobStateHandler.exit(id, entity);
                        state.mode = nextMode;
                    }
                    // Job State가 실행되었으므로 기본 상태 핸들러는 건너뜀
                    const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
                    if (mag > maxSpeed && mag > 0) {
                        transform.vx = (transform.vx / mag) * maxSpeed;
                        transform.vy = (transform.vy / mag) * maxSpeed;
                    }
                    return;
                }
            }
        }
        
        // 3. 일반 상태 핸들러 실행
        const stateHandler = this.stateFactory.getState(state.mode);
        if (stateHandler) {
            const nextMode = stateHandler.update(id, entity, dt);
            if (nextMode && nextMode !== state.mode) {
                if (stateHandler.exit) stateHandler.exit(id, entity);
                
                // 🧹 상태 전이 시 타겟 및 경로 초기화
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

        // 4. 속도 제한 적용
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
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

        // 1. 🍖 허기 업데이트
        const hungerRate = 1.0 * timeScale * activityMult;
        stats.hunger = Math.max(0, stats.hunger - dt * hungerRate);

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
