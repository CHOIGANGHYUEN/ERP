import System from '../../core/System.js';
import SpatialHash from '../../utils/SpatialHash.js';
import { AnimalStates, DietType } from '../../components/behavior/State.js';
import FoodSensor from './sensors/FoodSensor.js';
import BeeBrain from './brains/BeeBrain.js';
import StateFactory from './states/StateFactory.js';

export default class AnimalBehaviorSystem extends System {
    constructor(entityManager, eventBus, engine, spatialHash) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.spatialHash = spatialHash;

        // 상태 인스턴스 생성을 StateFactory로 위임 (의존성 역전)
        this.stateFactory = new StateFactory(this);
        this.foodSensor = new FoodSensor(this.entityManager, this.spatialHash);
        this.beeBrain = new BeeBrain(this.entityManager, this.eventBus, this.engine, this.spatialHash);
    }

    update(dt, time) {
        const em = this.entityManager;
        const frameCount = this.engine.frameCount || 0;

        // 1. 공간 해시맵 동적 갱신 (움직이는 동물만 반영하여 CPU 부하 절감)
        this.spatialHash.clearDynamic();
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (entity) {
                const transform = entity.components.get('Transform');
                if (transform) {
                    this.spatialHash.insert(id, transform.x, transform.y, false); // Dynamic
                }
            }
        }
        
        // 🌿 [Expert Optimization] 정적 개체(Resource) 정기 동기화
        // 100프레임마다 전수 조사를 통해 누락된 자원이나 유령 데이터를 완벽히 정리합니다.
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
                // 🚀 [Optimization] AI 틱 최적화 완화 (5프레임 -> 2프레임)
                if ((id + frameCount) % 2 === 0) {
                    if (animal.type === 'bee') {
                        this.beeBrain.update(id, state, transform, animal, dt * 2); 
                    } else {
                        // 인간(human)은 HumanBehaviorSystem에서 별도로 처리하므로 스킵
                        if (animal.type !== 'human') {
                            this.updateEntityAI(id, entity, state, transform, animal, stats, dt * 2);
                        }
                    }

                    const visual = entity.components.get('Visual');
                    if (visual) {
                        visual.isEating = (state.mode === AnimalStates.EAT);
                        visual.isInside = (state.mode === 'bee_inside');
                        visual.isSleeping = (state.mode === AnimalStates.SLEEP);
                    }
                }
            }
        }
    }

    refreshStaticHash() {
        const em = this.entityManager;
        this.spatialHash.clearAll();

        // 🐕 동물(Dynamic) 개체 일괄 재등록
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            const transform = entity?.components.get('Transform');
            if (transform) {
                this.spatialHash.insert(id, transform.x, transform.y, false);
            }
        }

        // 🌲 자원(Static) 개체 일괄 재등록
        for (const id of em.resourceIds) {
            const entity = em.entities.get(id);
            const transform = entity?.components.get('Transform');
            if (transform) {
                this.spatialHash.insert(id, transform.x, transform.y, true);
            }
        }
    }

    // 🐝 [Note] 벌 AI 로직은 전용 클래스인 BeeBrain.js로 완전히 이관되었습니다.

    updateEntityAI(id, entity, state, transform, animal, stats, dt) {
        const config = this.engine.speciesConfig[animal.type] || {};
        let maxSpeed = config.moveSpeed || 40;
        const hungerDecayRate = config.hungerDecayRate !== undefined ? config.hungerDecayRate : 0.2;
        const fatigueIncreaseRate = config.fatigueIncreaseRate !== undefined ? config.fatigueIncreaseRate : 0.1;
        const runSpeedMultiplier = config.runSpeedMultiplier !== undefined ? config.runSpeedMultiplier : 1.5;
        const approachSlowdownRadius = config.approachSlowdownRadius !== undefined ? config.approachSlowdownRadius : 20;

        // 1. 시간대별 생체 리듬 업데이트
        if (stats) {
            const timeSystem = this.engine.timeSystem;
            const hour = timeSystem.hours;
            
            // 🌙 밤(22:00~05:00)에는 피로도가 3배 빠르게 쌓이고, 낮에는 정상적으로 쌓임
            const isNight = hour >= 22 || hour < 5;
            const isEvening = hour >= 20 && hour < 22;
            
            let currentFatigueRate = fatigueIncreaseRate;
            if (isNight) currentFatigueRate *= 3;
            else if (isEvening) currentFatigueRate *= 1.5;

            // 허기 감소율
            const hungerDecayRate = 1.0 * this.engine.timeSystem.timeScale;
            const decayAmount = dt * hungerDecayRate;
            stats.hunger -= decayAmount;
            
            // 🧪 [사용자 피드백 반영] 소화 로직: 포만감이 줄어드는 만큼 영양분이 쌓임
            // digestionQuality가 높을수록(좋은 식물) 영양분 축적 효율 상승
            const quality = stats.digestionQuality || 0.5;
            stats.storedFertility += decayAmount * quality * 2.0; 
            
            if (stats.hunger < 0) stats.hunger = 0;

            // 💀 [Starvation Damage] 허기가 0이면 체력이 급격히 하락 (초당 10 데미지)
            if (stats.hunger <= 0) {
                stats.health -= dt * 10;
            }
            
            // 피로도 업데이트 (수면 중에는 감소, 깨어 있을 때는 증가)
            if (state.mode === AnimalStates.SLEEP) {
                stats.fatigue -= dt * 0.5; // 수면 시 피로 회복
                if (stats.fatigue <= 0) stats.fatigue = 0;
                
                // 🌅 아침(05:00 이후)이고 충분히 쉬었다면 기상
                if (hour >= 5 && hour < 20 && stats.fatigue < 10) {
                    state.mode = AnimalStates.IDLE;
                }
            } else {
                stats.fatigue += dt * currentFatigueRate;
                
                // 🌑 밤이고 피로가 쌓였다면 수면 시도
                if (isNight && stats.fatigue > 30 && Math.random() < 0.01) {
                    state.mode = AnimalStates.SLEEP;
                }
                // 극한의 피로 시 강제 수면
                if (stats.fatigue >= 100) {
                    state.mode = AnimalStates.SLEEP;
                }
            }

            // 💀 [Death Trigger] 체력이 0 이하가 되면 즉시 사망 상태로 전이
            if (stats.health <= 0) {
                stats.health = 0;
                state.mode = AnimalStates.DIE;
                state.targetId = null;
            }
        }


        // 2. 이동 속도 조절 (목적지 거리 기반)
        if (state.mode === AnimalStates.WALK || state.mode === AnimalStates.RUN || state.mode === AnimalStates.HUNT || state.mode === AnimalStates.FLEE) {
            if (state.targetId) {
                const target = this.entityManager.entities.get(state.targetId);
                if (target) {
                    const tPos = target.components.get('Transform');
                    if (tPos) {
                        const dist = Math.sqrt((tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2);
                        maxSpeed *= Math.min(1, dist / approachSlowdownRadius);
                    }
                }
            }
            // 질주/도망/추격 시 속도 배율 증가
            if (state.mode === AnimalStates.RUN || state.mode === AnimalStates.FLEE || state.mode === AnimalStates.HUNT) {
                maxSpeed *= runSpeedMultiplier;
            }
        }


        // 3. FSM 상태 업데이트 수행 (물리 마찰력 감쇠 로직은 KinematicSystem으로 일원화됨)

        // DIE 상태 전용 핸들러 (부패 로직)
        if (state.mode === AnimalStates.DIE) {
            // DeathProcessor.js 시스템으로 위임됨
            return;
        }

        const stateHandler = this.stateFactory.getState(state.mode);
        if (stateHandler) {
            const nextMode = stateHandler.update(id, entity, dt);
            if (nextMode && nextMode !== state.mode) {
                if (stateHandler.exit) stateHandler.exit(id, entity);
                state.mode = nextMode;
                const nextHandler = this.stateFactory.getState(nextMode);
                if (nextHandler && nextHandler.enter) nextHandler.enter(id, entity);
            }
        } else {
            state.mode = AnimalStates.IDLE;
        }

        // 최대 속도 제한 적용
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }


    // --- 🐾 상태별 핸들러 구현 ---

    // --- 🐾 시스템 내부 유틸리티 ---


    // --- 🍽️ 섭취 관련 헬퍼 메서드 ---

    consumePlant(entity, plantEntity) {
        if (!plantEntity) return;
        
        const stats = entity.components.get('BaseStats');
        const plantRes = plantEntity.components.get('Resource');
        
        // 🌿 [Expert Update] 식물이 머금은 비옥도를 동물에게 전달
        if (stats && plantRes) {
            // 식물이 가진 가치(비옥도)만큼 동물의 저장된 비옥도 증가
            const nutrientValue = plantRes.value || 5.0; 
            stats.storedFertility = (stats.storedFertility || 0) + nutrientValue;
            
            // 허기 즉시 일부 회복 (품질 반영)
            stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + nutrientValue * 2);
            stats.digestionQuality = (stats.digestionQuality || 0.5) * 0.5 + (plantRes.value || 0.5) * 0.5;
        }

        // 🌿 [Occupancy Cleanup] 자원 제거 시 점유 장부 비우기
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
        // 강결합을 끊고 CombatSystem으로 전투 이벤트 위임
        this.eventBus.emit('COMBAT_ATTACK', {
            attacker: entity,
            defender: victimEntity
        });
    }


    findFood(animalOrStats, x, y, searchRadius) {
        let nearestId = null;
        const diet = animalOrStats.diet || 'herbivore';
        const myType = animalOrStats.type; // 자신의 종

        const radius = searchRadius || (diet === 'carnivore' ? 400 : 250);
        let minDistSq = radius * radius;

        const em = this.entityManager;
        const nearbyIds = this.spatialHash.query(x, y, radius);

        for (const id of nearbyIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const targetAnim = entity.components.get('Animal');
            const targetRes = entity.components.get('Resource');
            const targetStats = entity.components.get('BaseStats');
            const tPos = entity.components.get('Transform');

            if (!tPos) continue;

            // 🗺️ [Terrain Filter] 이동 불가능한 지형(물, 산)에 있는 먹이는 무시
            if (!this.engine.terrainGen.isNavigable(tPos.x, tPos.y)) continue;

            if ((diet === 'carnivore' || diet === 'omnivore') && targetAnim) {
                const distSq = this._evaluatePrey(myType, diet, targetAnim, targetStats, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }

            if ((diet === 'herbivore' || diet === 'omnivore') && targetRes && targetRes.edible) {
                const distSq = this._evaluatePlant(diet, targetRes, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }
        }
        return nearestId;
    }

    _evaluatePrey(myType, diet, targetAnim, targetStats, tPos, x, y) {
        if (targetAnim.type === myType) return null;
        if (targetStats && targetStats.health <= 0) return null;
        if (diet === 'carnivore' && targetStats.diet === 'carnivore') return null;

        const dx = tPos.x - x;
        const dy = tPos.y - y;
        return dx * dx + dy * dy;
    }

    _evaluatePlant(diet, targetRes, tPos, x, y) {
        const dx = tPos.x - x;
        const dy = tPos.y - y;
        const distSq = dx * dx + dy * dy;
        const weight = (diet === 'omnivore') ? 1.2 : 1.0;
        return distSq / weight;
    }
}
