export default class BeeBrain {
    constructor(entityManager, eventBus, engine, spatialHash) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
        this.spatialHash = spatialHash;
    }

    update(id, state, transform, animal, dt) {
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

                // 일벌들이 모아온 꿀(Honey)을 소모해 새로운 애벌레 산란 (엔티티 스폰 대신 수치 증가)
                const hiveComp = hive.components.get('Hive');
                if (hiveComp && hiveComp.honey >= 30) {
                    hiveComp.honey -= 30;
                    hiveComp.larvaCount += 1; // 🐛 애벌레 수치 증가

                    this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: transform.x,
                        y: transform.y,
                        count: 5,
                        type: 'EFFECT',
                        color: '#fff176',
                        speed: 1.5
                    });
                }
                
                // 🐣 [Hatching Logic] 애벌레 부화 로직 (수치 -> 엔티티 전환)
                if (hiveComp && hiveComp.larvaCount > 0) {
                    state.hatchTimer = (state.hatchTimer || 0) + dt;
                    if (state.hatchTimer > 10) { // 10초마다 한 마리씩 부화
                        state.hatchTimer = 0;
                        hiveComp.larvaCount -= 1;
                        this.engine.spawner.spawnBee(transform.x, transform.y, 'worker', animal.hiveId);
                        
                        this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y, count: 3,
                            type: 'EFFECT', color: '#ffeb3b', speed: 1
                        });
                    }
                }
                if (hiveComp) hiveComp.hasQueen = true;
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
                    const hComp = hive.components.get('Hive');
                    transform.x = hPos.x; transform.y = hPos.y;
                    transform.vx = 0; transform.vy = 0;

                    // 🍯 [Demand-Driven Foraging] 벌집에 꿀이 부족할 때만 출격 (40 미만)
                    // 최소 3초는 휴식한 뒤에 상태 체크
                    if (animal.restTimer > 3 && hComp && hComp.honey < 40) {
                        animal.restTimer = 0;
                        state.mode = 'bee_wander';
                        transform.y -= 5; // 나무 위로 빠져나오는 연출
                        state.wanderAngle = -Math.PI / 2; // 위쪽 방향으로 출격
                    }
                }
            }
            else if (state.mode === 'bee_wander') {
                if (state.wanderAngle === undefined) state.wanderAngle = Math.random() * Math.PI * 2;

                // 🔄 [Expert Logic] 벌집 주변 순찰(Orbiting) 연출
                if (hive) {
                    const hPos = hive.components.get('Transform');
                    const dx = hPos.x - transform.x, dy = hPos.y - transform.y;
                    const distToHive = Math.sqrt(dx * dx + dy * dy);

                    // 벌집에서 너무 멀어지면 (40px) 벌집 쪽으로 강하게 끌어당김
                    if (distToHive > 40) {
                        const pullStrength = (distToHive - 40) * 10;
                        transform.vx += (dx / distToHive) * pullStrength * dt;
                        transform.vy += (dy / distToHive) * pullStrength * dt;
                        
                        // 방향도 벌집 쪽으로 서서히 틀어줌
                        state.wanderAngle = Math.atan2(dy, dx) + (Math.random() - 0.5);
                    }
                }

                if (Math.random() < 0.1) {
                    state.wanderAngle += (Math.random() - 0.5) * Math.PI;
                }
                const mass = transform.mass || 1;
                transform.vx += (Math.cos(state.wanderAngle) * 400 * dt) / mass;
                transform.vy += (Math.sin(state.wanderAngle) * 400 * dt) / mass;

                // 근처의 꿀(꽃) 찾기
                if (animal.nectar < 10 && Math.random() < 0.1) {
                    let bestDist = 40000;
                    let targetFlower = null;

                    const nearbyIds = this.spatialHash.query(transform.x, transform.y);
                    for (const fid of nearbyIds) {
                        const fEnt = em.entities.get(fid);
                        if (!fEnt) continue;

                        const r = fEnt.components.get('Resource');
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
                    const hiveComp = hive.components.get('Hive');
                    if (hiveComp) {
                        hiveComp.honey = Math.min(hiveComp.maxHoney, (hiveComp.honey || 0) + animal.nectar);
                        if (role === 'queen') hiveComp.hasQueen = true;
                    }
                    animal.nectar = 0;
                    state.mode = 'bee_inside'; // 집으로 쏙 들어감
                    transform.vx = 0; transform.vy = 0;
                } else {
                    const mass = transform.mass || 1;
                    transform.vx += (dx / dist) * 800 * dt / mass; transform.vy += (dy / dist) * 800 * dt / mass;
                }
            }
        }

        const maxSpeed = role === 'larva' ? 5 : (role === 'worker' ? 45 : 20);
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }
}