export default class BehaviorSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
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
            }
        }
    }

    updateBeeAI(id, state, transform, animal, dt) {
        const em = this.engine.entityManager;
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

                    for (let i = 0; i < 3; i++) {
                        this.engine.particles.push({
                            x: transform.x, y: transform.y - 5,
                            color: '#ffeb3b', type: 'EFFECT',
                            vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2,
                            speed: 1, targetY: -999, life: 30
                        });
                    }
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

                // 근처의 꿀(꽃) 찾기
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
                    animal.nectar += 10;
                    state.mode = 'bee_return';
                    transform.vx = 0; transform.vy = 0;

                    // 꽃의 비옥도를 소모시켜 점진적으로 시들게 만듦
                    const fRes = flower.components.get('Resource');
                    const fVis = flower.components.get('Visual');
                    if (fRes && fVis) {
                        fRes.storedFertility = Math.max(0, fRes.storedFertility - 0.2);
                        fVis.quality = fRes.storedFertility; // 렌더러의 시각적 품질과 동기화
                    }
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
        transform.vx *= 0.92; // 꿀벌 전용 공기 저항(마찰)
        transform.vy *= 0.92;

        // 최고 속도 제한 적용
        const maxSpeed = role === 'larva' ? 5 : (role === 'worker' ? 45 : 20);
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }

    updateEntityAI(id, state, transform, animal, dt) {
        const metabolism = this.engine.entityManager.entities.get(id).components.get('Metabolism');
        const config = this.engine.speciesConfig[animal.type] || {};
        const maxSpeed = config.moveSpeed || 40;
        const mass = transform.mass || 50;

        // 무게에 비례하여 근력을 부여해 체급별 가속도를 다르게 설정
        let musclePower = 4000; // 기본 양
        if (animal.type === 'cow') musclePower = 18000;
        else if (animal.type === 'human') musclePower = 8000;

        if (state.mode === 'wander') {
            // 1. Check for needs (e.g., hunger) and transition state
            const isHungry = metabolism && metabolism.stomach < (metabolism.maxStomach || 2.0) * 0.7;
            if (isHungry && Math.random() < 0.05) {
                const targetId = this.findFood(animal, transform.x, transform.y);
                if (targetId !== null) {
                    state.mode = 'eat';
                    state.targetId = targetId;
                    return; // Exit early to process 'eat' state in next frame
                }
            }

            // 목표 각도를 기억하여 유기적인 턴 유도
            if (state.wanderAngle === undefined) {
                state.wanderAngle = Math.random() * Math.PI * 2;
                state.pauseTimer = 0;
            }

            // 2. Perform wander behavior
            if (state.pauseTimer > 0) {
                state.pauseTimer -= dt;
                // 브레이크(무거운 동물은 제동거리가 더 깁니다)
                transform.vx *= 0.85; transform.vy *= 0.85;
            } else {
                if (Math.random() < 0.05) {
                    state.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.8;
                }

                // F = MA (질량에 따른 관성 가속)
                transform.vx += (Math.cos(state.wanderAngle) * musclePower * dt) / mass;
                transform.vy += (Math.sin(state.wanderAngle) * musclePower * dt) / mass;

                if (Math.random() < 0.005) state.pauseTimer = 1.0 + Math.random() * 2.0;
            }

        } else if (state.mode === 'flee') {
            const predator = this.engine.entityManager.entities.get(state.targetId);
            if (!predator) {
                state.mode = 'wander';
                state.targetId = null;
            } else {
                const predPos = predator.components.get('Transform');
                const dx = transform.x - predPos.x;
                const dy = transform.y - predPos.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 160000) { // 반경 400px 이상 멀어지면 안심
                    state.mode = 'wander';
                    state.targetId = null;
                } else {
                    // 포식자의 반대 방향으로 전력 질주
                    const dist = Math.sqrt(distSq);
                    const fleeForce = musclePower * 2.5;
                    transform.vx += ((dx / dist) * fleeForce * dt) / mass;
                    transform.vy += ((dy / dist) * fleeForce * dt) / mass;
                }
            }
        } else if (state.mode === 'eat') {
            const target = this.engine.entityManager.entities.get(state.targetId);
            // If target is gone (eaten or disappeared), go back to wandering
            if (!target) {
                state.mode = 'wander';
                state.targetId = null;
                return;
            }

            const targetPos = target.components.get('Transform');
            const dx = targetPos.x - transform.x;
            const dy = targetPos.y - transform.y;
            const distSq = dx * dx + dy * dy;

            // 타겟이 생명체(초식동물)라면 사냥꾼을 인식하고 도망치도록 상태 전이
            const targetAnimal = target.components.get('Animal');
            const targetState = target.components.get('AIState');
            if (targetAnimal && targetState && targetState.mode !== 'flee') {
                targetState.mode = 'flee';
                targetState.targetId = id; // 포식자(나)를 피하도록 지정
            }

            // If not close enough, move towards target.
            // The actual eating is handled by ConsumptionSystem when close.
            if (distSq >= 25) { // 사냥 타격 판정을 위해 16 -> 25 로 넓힘
                const dist = Math.sqrt(distSq);
                const eatForce = musclePower * 1.8; // 먹이(사냥감)를 향해 더 강한 추진력
                transform.vx += ((dx / dist) * eatForce * dt) / mass;
                transform.vy += ((dy / dist) * eatForce * dt) / mass;
            } else {
                // Close enough, stop moving and wait for ConsumptionSystem to act.
                transform.vx *= 0.5;
                transform.vy *= 0.5;
            }
        }

        // 모든 지상 생명체에 자연스러운 바닥 마찰력 적용
        transform.vx *= 0.94; transform.vy *= 0.94;

        const currentSpeed = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        // 도망(Flee) 상태일 때는 아드레날린으로 최고 속도 1.5배 증가
        const speedLimit = state.mode === 'flee' ? maxSpeed * 1.5 : maxSpeed;
        if (currentSpeed > speedLimit && currentSpeed > 0) {
            transform.vx = (transform.vx / currentSpeed) * speedLimit;
            transform.vy = (transform.vy / currentSpeed) * speedLimit;
        }
    }

    findFood(animal, x, y) {
        let nearestId = null;
        let minDistSq = animal.diet === 'carnivore' ? 160000 : 62500; // 육식동물 시야 400px, 초식 250px
        const em = this.engine.entityManager;

        for (const [id, entity] of em.entities) {
            if (animal.diet === 'carnivore') {
                const prey = entity.components.get('Animal');
                // 육식동물은 초식동물을 먹잇감으로 탐색
                if (prey && prey.diet === 'herbivore') {
                    const pos = entity.components.get('Transform');
                    const d2 = (pos.x - x) ** 2 + (pos.y - y) ** 2;
                    if (d2 < minDistSq) {
                        minDistSq = d2;
                        nearestId = id;
                    }
                }
            } else {
                const resource = entity.components.get('Resource');
                // 초식동물은 바닥의 풀이나 꽃을 탐색
                if (resource && (resource.isGrass || resource.isFlower)) {
                    const pos = entity.components.get('Transform');
                    const d2 = (pos.x - x) ** 2 + (pos.y - y) ** 2;
                    if (d2 < minDistSq) {
                        minDistSq = d2;
                        nearestId = id;
                    }
                }
            }
        }
        return nearestId;
    }
}