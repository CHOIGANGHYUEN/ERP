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
        
        // 🚀 [Optimization] 정적 해시 갱신 로직 제거 (이미 개별 팩토리 및 KinematicSystem에서 관리됨)

        const camera = this.engine.camera;
        const viewW = (this.engine.width / (camera.zoom || 1)) + 100;
        const viewH = (this.engine.height / (camera.zoom || 1)) + 100;
        const viewX = camera.x - 50;
        const viewY = camera.y - 50;

        // 🚀 [Optimization] 프레임당 무거운 탐색(Target Search) 횟수 제한 (Time-slicing)
        let searchCount = 0;
        const SEARCH_LIMIT_PER_FRAME = 5;

        const items = em.animalIds.items;
        for (let i = 0; i < items.length; i++) {
            const id = items[i];
            const entity = em.entities.get(id);
            if (!entity) continue;

            const state = entity.components.get('AIState');
            const transform = entity.components.get('Transform');
            const animal = entity.components.get('Animal');
            const stats = entity.components.get('BaseStats');

            if (state && transform && animal) {
                // 1. [AI LOD] 가시성 및 거리에 따른 극단적 업데이트 빈도 조절 (200k 스케일 대응)
                const isVisible = transform.x >= viewX && transform.x <= viewX + viewW &&
                                   transform.y >= viewY && transform.y <= viewY + viewH;
                
                let updateModulo = 2; // 화면 안: 30 FPS 수준
                
                if (!isVisible) {
                    const centerX = viewX + viewW / 2;
                    const centerY = viewY + viewH / 2;
                    const dist = Math.abs(transform.x - centerX) + Math.abs(transform.y - centerY);
                    const isFar = dist > (viewW + viewH) * 2; 
                    
                    // 원거리: 60프레임당 1회 (1 FPS), 근거리 화면 밖: 15프레임당 1회 (4 FPS)
                    updateModulo = isFar ? 60 : 15;
                }

                if ((id + frameCount) % updateModulo === 0) {
                    const effectiveDt = dt * updateModulo;

                    // 🧠 [Target Caching] 타겟 유효성 검사 및 재탐색 억제
                    if (state.targetId && state.targetId !== 'wander_pos') {
                        const target = em.entities.get(state.targetId);
                        if (!target) {
                            state.targetId = null;
                        } else {
                            const tStats = target.components.get('BaseStats');
                            if (tStats && tStats.health <= 0) state.targetId = null;
                        }
                    }

                    // 탐색이 필요한 상태인데 타겟이 없고, 이번 프레임 탐색 할당량이 남았다면 탐색 허용
                    const needsSearch = !state.targetId && [AnimalStates.HUNT, AnimalStates.GRAZE, AnimalStates.FORAGE].includes(state.mode);
                    const canSearch = searchCount < SEARCH_LIMIT_PER_FRAME;
                    
                    if (needsSearch && canSearch) {
                        searchCount++;
                        state.canSearchThisFrame = true;
                    } else {
                        state.canSearchThisFrame = false;
                    }

                    let suggestion = null;
                    if (animal.type === 'bee') {
                        suggestion = this.beeBrain.decide(id, state, transform, animal, effectiveDt); 
                    } else if (animal.type !== 'human') {
                        if (animal.diet === 'carnivore') {
                            suggestion = this.carnivoreBrain.decide(id, state, transform, animal, stats, effectiveDt);
                        } else {
                            suggestion = this.herbivoreBrain.decide(id, state, transform, animal, stats, effectiveDt);
                        }
                    }

                    // 공통 상태 실행 및 전이 판단
                    this.updateEntityAI(id, entity, state, transform, animal, stats, effectiveDt, suggestion);

                    const visual = entity.components.get('Visual');
                    if (visual) {
                        visual.isEating = (state.mode === AnimalStates.EAT);
                        visual.isSleeping = (state.mode === AnimalStates.SLEEP);
                    }
                }
            }
        }
    }


    updateEntityAI(id, entity, state, transform, animal, stats, dt, suggestion) {
        if (!state.mode) state.mode = AnimalStates.IDLE;

        // 💀 Death Check (최우선 인터럽트)
        if (stats && stats.health <= 0) {
            if (state.mode !== AnimalStates.DIE) this._transitionTo(id, entity, state, AnimalStates.DIE);
            return;
        }

        const stateHandler = this.stateFactory.getState(state.mode);
        if (stateHandler) {
            let nextMode = stateHandler.update(id, entity, dt);
            
            // 💡 [Persistence Logic] 작업 완료(IDLE), 중단 가능(interruptible), 또는 긴급 상황(Emergency) 시에만 전이 허용
            const isFinished = nextMode === AnimalStates.IDLE;
            const isEmergency = suggestion && (
                suggestion.mode === AnimalStates.FLEE || 
                suggestion.mode === AnimalStates.DIE || 
                suggestion.mode === AnimalStates.GRABBED
            );
            const canInterrupt = state.interruptible !== false;
            
            if (isFinished || isEmergency || canInterrupt) {
                if (suggestion && suggestion.mode !== state.mode) {
                    // 타겟 업데이트 (제안에 타겟이 포함된 경우)
                    if (suggestion.targetId !== undefined) {
                        state.targetId = suggestion.targetId;
                    }
                    nextMode = suggestion.mode;
                }
            }

            if (nextMode && nextMode !== state.mode) {
                this._transitionTo(id, entity, state, nextMode);
            }
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
        state.abstractPath = null;
        state.abstractIndex = 0;
        state.interruptible = true; // 🛡️ 상태 전이 시 기본적으로 중단 가능으로 초기화

        const velocity = entity.components.get('Velocity');
        if (velocity) {
            velocity.vx = 0;
            velocity.vy = 0;
        }

        // 타겟 유지 조건
        const preservesTarget = [
            AnimalStates.EAT, AnimalStates.PICKUP, AnimalStates.ATTACK, 
            AnimalStates.FORAGE, AnimalStates.HUNT, AnimalStates.GRAZE,
            'bee_gather', 'bee_return'
        ].includes(nextMode);

        if (!preservesTarget) state.targetId = null;

        state.mode = nextMode;
        const nextHandler = this.stateFactory.getState(nextMode);
        if (nextHandler && nextHandler.enter) nextHandler.enter(id, entity);
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
