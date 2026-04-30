import System from '../../core/System.js';
import SpatialHash from '../../utils/SpatialHash.js';
import WanderState from './states/WanderState.js';
import HuntState from './states/HuntState.js';
import ForageState from './states/ForageState.js';
import EatState from './states/EatState.js';
import SleepState from './states/SleepState.js';
import FleeState from './states/FleeState.js';
import GatherWoodState from './states/GatherWoodState.js';
import BuildState from './states/BuildState.js';

import { AnimalStates, DietType } from '../../components/behavior/State.js';

export default class AnimalBehaviorSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.spatialHash = new SpatialHash(100); // 탐색 범위에 맞는 적절한 셀 크기 (100px)
        
        // FSM 상태 핸들러 맵
        this.states = {
            [AnimalStates.IDLE]: new WanderState(this),
            [AnimalStates.WALK]: new WanderState(this), // 기본 Wander 로직 재사용
            [AnimalStates.RUN]: new WanderState(this),  // 속도 조절은 updateEntityAI에서 처리
            [AnimalStates.HUNT]: new HuntState(this),
            [AnimalStates.FORAGE]: new ForageState(this),
            [AnimalStates.EAT]: new EatState(this),
            [AnimalStates.SLEEP]: new SleepState(this),
            [AnimalStates.FLEE]: new FleeState(this),
            [AnimalStates.EVADE]: new FleeState(this),
            'gather_wood': new GatherWoodState(this),
            'build': new BuildState(this)
        };


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
                    this.updateBeeAI(id, state, transform, animal, dt);
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

        // 1. 피로도 및 허기 수치 업데이트 (상태 전이는 각 State 클래스에서 담당하도록 위임)
        if (stats) {
            // 허기 감소율 완화 (100 -> 0까지 약 500초 소요)
            stats.hunger -= dt * 0.2;
            // 피로도 상승률 완화 (0 -> 100까지 약 1000초 소요)
            stats.fatigue += dt * 0.1;
            
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
                        const dist = Math.sqrt((tPos.x - transform.x)**2 + (tPos.y - transform.y)**2);
                        maxSpeed *= Math.min(1, dist / 20);
                    }
                }
            }
            // 질주/도망/추격 시 속도 1.5배 증가
            if (state.mode === AnimalStates.RUN || state.mode === AnimalStates.FLEE || state.mode === AnimalStates.HUNT) {
                maxSpeed *= 1.5;
            }
        }


        // 3. FSM 상태 업데이트 수행
        transform.vx *= 0.95;
        transform.vy *= 0.95;

        // DIE 상태 전용 핸들러 (부패 로직)
        if (state.mode === AnimalStates.DIE) {
            this.handleDieState(entity, dt);
            return;
        }

        const stateHandler = this.states[state.mode];
        if (stateHandler) {
            const nextMode = stateHandler.update(id, entity, dt);
            if (nextMode && nextMode !== state.mode) {
                if (stateHandler.exit) stateHandler.exit(id, entity);
                state.mode = nextMode;
                const nextHandler = this.states[nextMode];
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
        // 식물 엔티티 제거 또는 자원 감소 로직 (여기서는 단순 제거로 가정)
        this.entityManager.removeEntity(plantEntity.id);
    }

    attackAndConsumeAnimal(entity, victimEntity) {
        if (!victimEntity) return;
        // 사냥 로직: 체력 감소 등 (여기서는 단순 사망 상태 전환으로 가정)
        const vState = victimEntity.components.get('AIState');
        if (vState) vState.mode = AnimalStates.DIE;
    }

    // handleDieState: 엔티티 사망 시 서서히 부패하며 대지에 비옥도를 환원합니다.
    handleDieState(entity, dt) {
        const visual = entity.components.get('Visual');
        const transform = entity.components.get('Transform');
        const em = this.entityManager;

        if (visual) {
            // 1. 알파값 감소 (페이드아웃)
            visual.alpha = Math.max(0, visual.alpha - dt * 0.5); // 약 2초간 지속

            // 2. 비옥도 환원 로직
            if (transform && this.engine.terrainGen) {
                const x = Math.floor(transform.x);
                const y = Math.floor(transform.y);
                const width = this.engine.mapWidth;
                const height = this.engine.mapHeight;

                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const idx = y * width + x;
                    const fertilityBuffer = this.engine.terrainGen.fertilityBuffer;
                    
                    if (fertilityBuffer) {
                        // 대지에 비옥도를 조금씩 주입 (정수 버퍼 호환을 위해 확률적 올림 적용)
                        const currentFertility = fertilityBuffer[idx];
                        const increment = dt * 10;
                        const finalIncrement = (Math.random() < increment % 1) ? Math.floor(increment) + 1 : Math.floor(increment);
                        
                        if (finalIncrement > 0) {
                            fertilityBuffer[idx] = Math.min(100, currentFertility + finalIncrement);
                        }

                        
                        // 지형 리렌더링을 위해 청크 더티 마킹
                        if (this.engine.chunkManager) {
                            this.engine.chunkManager.markDirty(x, y);
                        }
                    }
                }
            }

            // 3. 완전히 사라지면 엔티티 제거
            if (visual.alpha <= 0) {
                em.removeEntity(entity.id);
            }
        } else {
            // Visual 컴포넌트가 없으면 즉시 제거
            em.removeEntity(entity.id);
        }
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

            // --- 🍖 육식/잡식의 동물 사냥 판정 ---
            if ((diet === 'carnivore' || diet === 'omnivore') && targetAnim) {
                // 1. 자신과 같은 종은 공격하지 않음
                if (targetAnim.type === myType) continue;
                // 2. 이미 죽은 동물 제외
                if (targetStats && targetStats.health <= 0) continue;
                
                // 3. 육식 동물은 다른 육식 동물을 사냥하지 않음 (생태계 균형)
                if (diet === 'carnivore' && targetStats.diet === 'carnivore') continue;

                const dx = tPos.x - x;
                const dy = tPos.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }

            // --- 🌿 초식/잡식의 식물 섭취 판정 ---
            if ((diet === 'herbivore' || diet === 'omnivore') && targetRes && targetRes.edible) {
                const dx = tPos.x - x;
                const dy = tPos.y - y;
                const distSq = dx * dx + dy * dy;
                
                // 잡식은 고기를 식물보다 약간 더 선호하도록 가중치 부여 가능
                const weight = (diet === 'omnivore') ? 1.2 : 1.0; 
                if (distSq < minDistSq * weight) {
                    minDistSq = distSq / weight;
                    nearestId = id;
                }
            }
        }
        return nearestId;
    }


}
