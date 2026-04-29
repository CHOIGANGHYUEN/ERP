import System from '../../core/System.js';
import SpatialHash from '../../utils/SpatialHash.js';
import WanderState from './states/WanderState.js';
import HuntState from './states/HuntState.js';
import EatState from './states/EatState.js';
import FleeState from './states/FleeState.js';
import GatherWoodState from './states/GatherWoodState.js';
import BuildState from './states/BuildState.js';

export default class AnimalBehaviorSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.spatialHash = new SpatialHash(100); // 탐색 범위에 맞는 적절한 셀 크기 (100px)
        
        // FSM 상태 핸들러 맵
        this.states = {
            'wander': new WanderState(this),
            'hunt': new HuntState(this),
            'eat': new EatState(this),
            'flee': new FleeState(this),
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

            if (state && transform && animal) {
                // 🐝 벌을 위한 전용 곤충 AI 시뮬레이션
                if (animal.type === 'bee') {
                    this.updateBeeAI(id, state, transform, animal, dt);
                } else {
                    this.updateEntityAI(id, state, transform, animal, dt);
                }

                // 렌더러(EntityRenderer)와의 결합도를 끊기 위해 Visual 컴포넌트에 시각적 상태 기록
                const visual = entity.components.get('Visual');
                if (visual) {
                    visual.isEating = (state.mode === 'eat');
                    visual.isInside = (state.mode === 'bee_inside');
                }
            }
        }
    }

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

                // 근처의 꿀(꽃) 찾기 (공간 해시맵을 활용하여 최적화 가능하나 일단 유지)
                if (animal.nectar < 10 && Math.random() < 0.1) {
                    let bestDist = 40000; // 반경 200px
                    let targetFlower = null;
                    for (const [fid, fEnt] of em.entities) {
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

    updateEntityAI(id, state, transform, animal, dt) {
        const config = this.engine.speciesConfig[animal.type] || {};
        const maxSpeed = config.moveSpeed || 40;

        // 마찰력을 낮춰서 동물이 바닥에 굳는(마비되는) 현상 해결
        transform.vx *= 0.95;
        transform.vy *= 0.95;

        // FSM 상태 전이 및 업데이트 처리
        const stateHandler = this.states[state.mode];
        if (stateHandler) {
            const nextMode = stateHandler.update(id, this.entityManager.entities.get(id), dt);
            if (nextMode && nextMode !== state.mode) {
                const nextHandler = this.states[nextMode];
                if (stateHandler.exit) stateHandler.exit(id, this.entityManager.entities.get(id));
                state.mode = nextMode;
                if (nextHandler && nextHandler.enter) nextHandler.enter(id, this.entityManager.entities.get(id));
            }
        } else {
            state.mode = 'wander'; // 알 수 없는 상태일 경우 기본값
        }

        // 최대 속도 제한 적용 (동물 체급별 이동속도)
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }

    findFood(animal, x, y) {
        let nearestId = null;
        let minDistSq = animal.diet === 'carnivore' ? 160000 : 62500;
        const em = this.entityManager;
        
        // 공간 해시맵을 사용하여 검색 범위를 대폭 좁힘 (반경 계산)
        const radius = Math.sqrt(minDistSq);
        const nearbyIds = this.spatialHash.query(x, y, radius);

        for (const id of nearbyIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            
            const targetAnim = entity.components.get('Animal');
            const targetRes = entity.components.get('Resource');
            const tPos = entity.components.get('Transform');

            if (!tPos) continue;

            // 육식 동물의 경우: 주변의 다른 동물 찾기
            if (animal.diet === 'carnivore' && targetAnim && targetAnim.type !== animal.type) {
                const dx = tPos.x - x;
                const dy = tPos.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }
            // 초식/잡식 동물의 경우: 먹을 수 있는 식물이나 고기(자원) 찾기
            else if ((animal.diet === 'herbivore' || animal.diet === 'omnivore') && targetRes && targetRes.edible) {
                const dx = tPos.x - x;
                const dy = tPos.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }
        }
        return nearestId;
    }
}
