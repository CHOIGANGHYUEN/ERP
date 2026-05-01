import System from '../../core/System.js';
import SpatialHash from '../../utils/SpatialHash.js';
import { AnimalStates, DietType } from '../../components/behavior/State.js';
import FoodSensor from './sensors/FoodSensor.js';
import BeeBrain from './brains/BeeBrain.js';
import StateFactory from './states/StateFactory.js';

export default class AnimalBehaviorSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.spatialHash = new SpatialHash(100); // 탐색 범위에 맞는 적절한 셀 크기 (100px)

        // 상태 인스턴스 생성을 StateFactory로 위임 (의존성 역전)
        this.stateFactory = new StateFactory(this);
        this.foodSensor = new FoodSensor(this.entityManager, this.spatialHash);
        this.beeBrain = new BeeBrain(this.entityManager, this.eventBus, this.engine, this.spatialHash);

    }

    update(dt, time) {
        const em = this.entityManager;

        // 1. 공간 해시맵 갱신 (먹이 탐색 등의 최적화를 위함)
        this.spatialHash.clear();
        for (const [id, entity] of em.entities) {
            const transform = entity.components.get('Transform');
            if (transform) {
                this.spatialHash.insert(id, transform.x, transform.y);
            }
        }

        // 2. 각 엔티티별 AI 상태 업데이트
        for (const [id, entity] of em.entities) {
            const state = entity.components.get('AIState');
            const transform = entity.components.get('Transform');
            const animal = entity.components.get('Animal');
            const stats = entity.components.get('BaseStats');

            if (state && transform && animal) {
                // 🐝 벌을 위한 전용 곤충 AI 시뮬레이션
                if (animal.type === 'bee') {
                    this.beeBrain.update(id, state, transform, animal, dt);
                } else {
                    this.updateEntityAI(id, entity, state, transform, animal, stats, dt);
                }

                // 렌더러(EntityRenderer)와의 결합도를 끊기 위해 Visual 컴포넌트에 시각적 상태 기록
                const visual = entity.components.get('Visual');
                if (visual) {
                    visual.isEating = (state.mode === AnimalStates.EAT);
                    visual.isInside = (state.mode === 'bee_inside');
                }
            }
        }
    }

    // ... (updateBeeAI remains unchanged, I'll just keep it or skip it in the replacement block to save tokens, 
    // but the tool requires the full ReplacementContent for the range. I'll include it.)

    updateBeeAI(id, state, transform, animal, dt) {
        const em = this.entityManager;
        const role = animal.role || 'worker';
        const hive = em.entities.get(animal.hiveId);

        // 벌집 파괴 시 방황
        if (!hive && state.mode === 'bee_inside') {
            state.mode = 'bee_wander';
            if (role !== 'worker') {
                animal.role = 'worker'; // 여왕/애벌레도 집잃으면 일벌로 강등되어 떠돔
                const visual = em.entities.get(id).components.get('Visual');
                if (visual) visual.role = 'worker';
            }
        }

        // 1. 애벌레(Larva) 로직
        if (role === 'larva') {
            state.mode = 'bee_inside';
            animal.age = (animal.age || 0) + dt;
            if (animal.age > 20) { // 20초 후 일벌로 변태
                animal.role = 'worker';
                animal.age = 0;
                const visual = em.entities.get(id).components.get('Visual');
                if (visual) visual.role = 'worker';
            }
            if (hive) {
                const hPos = hive.components.get('Transform');
                transform.x = hPos.x; transform.y = hPos.y;
            }
        }

        // 2. 여왕벌(Queen) 로직
        else if (role === 'queen') {
            state.mode = 'bee_inside';
            if (hive) {
                const hPos = hive.components.get('Transform');
                transform.x = hPos.x; transform.y = hPos.y;

                // 일벌들이 모아온 꿀(Honey)을 소모해 새로운 애벌레 산란
                const hRes = hive.components.get('Resource');
                if (hRes && hRes.honey >= 30) {
                    hRes.honey -= 30;
                    this.engine.spawner.spawnBee(transform.x, transform.y, 'larva', animal.hiveId);

                    this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: transform.x,
                        y: transform.y,
                        count: 3,
                        type: 'EFFECT',
                        color: '#ffeb3b',
                        speed: 2
                    });
                }
            }
        }

        // 3. 일벌(Worker) 로직
        else if (role === 'worker') {
            animal.nectar = animal.nectar || 0;
            if (!['bee_gather', 'bee_return', 'bee_inside', 'bee_wander'].includes(state.mode)) {
                state.mode = 'bee_inside';
            }

            if (state.mode === 'bee_inside') {
                animal.restTimer = (animal.restTimer || 0) + dt;

                if (hive) {
                    const hPos = hive.components.get('Transform');
                    transform.x = hPos.x; transform.y = hPos.y;
                    transform.vx = 0; transform.vy = 0;
                }

                // 5~10초 대기 후 꿀을 채집하러 출격
                if (animal.restTimer > 5 + Math.random() * 5) {
                    animal.restTimer = 0;
                    state.mode = 'bee_wander';
                    if (hive) transform.y -= 5; // 나무 위로 빠져나오는 연출
                }
            }
            else if (state.mode === 'bee_wander') {
                if (state.wanderAngle === undefined) state.wanderAngle = Math.random() * Math.PI * 2;

                if (Math.random() < 0.1) {
                    state.wanderAngle += (Math.random() - 0.5) * Math.PI;
                }
                const mass = transform.mass || 1;
                transform.vx += (Math.cos(state.wanderAngle) * 400 * dt) / mass;
                transform.vy += (Math.sin(state.wanderAngle) * 400 * dt) / mass;

                // 근처의 꿀(꽃) 찾기 (공간 해시맵을 활용하여 최적화 완료)
                if (animal.nectar < 10 && Math.random() < 0.1) {
                    let bestDist = 40000; // 반경 200px
                    let targetFlower = null;

                    const nearbyIds = this.spatialHash.query(transform.x, transform.y);
                    for (const fid of nearbyIds) {
                        const fEnt = em.entities.get(fid);
                        if (!fEnt) continue;

                        const r = fEnt.components.get('Resource');
                        // 꿀(비옥도)이 남아있는 살아있는 꽃만 타겟팅
                        if (r && r.isFlower && r.storedFertility > 0) {
                            const fPos = fEnt.components.get('Transform');
                            const d2 = (fPos.x - transform.x) ** 2 + (fPos.y - transform.y) ** 2;
                            if (d2 < bestDist) { bestDist = d2; targetFlower = fid; }
                        }
                    }
                    if (targetFlower) { state.mode = 'bee_gather'; state.targetId = targetFlower; }
                } else if (animal.nectar >= 10 && hive) {
                    state.mode = 'bee_return'; // 꿀통 꽉참 -> 귀환
                }

            } else if (state.mode === 'bee_gather') {
                const flower = em.entities.get(state.targetId);
                if (!flower || !flower.components.get('Resource')?.isFlower) { state.mode = 'bee_wander'; return; }

                const fPos = flower.components.get('Transform');
                const dx = fPos.x - transform.x, dy = fPos.y - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 5) {
                    transform.vx = 0; transform.vy = 0;
                    // GatheringSystem.js에서 꿀 섭취 및 모드 변경(bee_return)을 처리합니다.
                }
                else {
                    const mass = transform.mass || 1;
                    transform.vx += (dx / dist) * 600 * dt / mass; transform.vy += (dy / dist) * 600 * dt / mass;
                }
            } else if (state.mode === 'bee_return') {
                if (!hive) { state.mode = 'bee_wander'; return; }
                const hPos = hive.components.get('Transform');
                const dx = hPos.x - transform.x, dy = hPos.y - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 8) {
                    const hRes = hive.components.get('Resource');
                    if (hRes) hRes.honey = (hRes.honey || 0) + animal.nectar;
                    animal.nectar = 0;
                    state.mode = 'bee_inside'; // 집으로 쏙 들어감
                    transform.vx = 0; transform.vy = 0;
                } else {
                    const mass = transform.mass || 1;
                    transform.vx += (dx / dist) * 800 * dt / mass; transform.vy += (dy / dist) * 800 * dt / mass;
                }
            }
        }
        transform.vx *= 0.92;
        transform.vy *= 0.92;

        const maxSpeed = role === 'larva' ? 5 : (role === 'worker' ? 45 : 20);
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }

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

            // 사망 상태는 즉시 강제 전이 (최우선 순위)
            if (stats.health <= 0) {
                state.mode = AnimalStates.DIE;
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
        
        // 🌿 [Occupancy Cleanup] 자원 제거 시 점유 장부 비우기
        const pt = plantEntity.components.get('Transform');
        if (pt && this.engine.terrainGen) {
            this.engine.terrainGen.setOccupancy(pt.x, pt.y, 0);
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
