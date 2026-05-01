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

        const maxSpeed = role === 'larva' ? 5 : (role === 'worker' ? 45 : 20);
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }
}