export default class SocialSystem {
    constructor(engine) {
        this.engine = engine;
        this.herds = new Map(); // herdId -> [entityId, ...]
        this.nextHerdId = 1;
    }

    update(dt) {
        const em = this.engine.entityManager;

        // 1. Cleanup dead members
        for (const [hId, members] of this.herds) {
            const alive = members.filter(mid => em.entities.has(mid));
            if (alive.length === 0) {
                this.herds.delete(hId);
            } else {
                this.herds.set(hId, alive);
            }
        }

        // 2. Assign herds & apply flocking
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            const transform = entity.components.get('Transform');
            if (animal && transform) {
                this.maintainHerd(id, animal);
                this.applyFlocking(id, animal, transform, dt);
            }
        }
    }

    maintainHerd(id, animal) {
        const config = this.engine.speciesConfig[animal.type] || {};
        const limit = config.herdLimit || 20;

        if (animal.herdId === undefined || animal.herdId === -1) {
            let found = false;
            for (const [hId, members] of this.herds) {
                if (members.length < limit && members.length > 0) {
                    const em = this.engine.entityManager;
                    const leaderAnimal = em.entities.get(members[0])?.components.get('Animal');
                    // 같은 종족끼리만 무리를 형성하도록 체크
                    if (leaderAnimal && leaderAnimal.type === animal.type) {
                        members.push(id);
                        // 🐺 서열(Rank)에 따른 무리 내림차순 정렬 (가장 쎈 개체가 0번 인덱스 리더가 됨)
                        members.sort((a, b) => {
                            const rankA = em.entities.get(a)?.components.get('Animal')?.rank || 0;
                            const rankB = em.entities.get(b)?.components.get('Animal')?.rank || 0;
                            return rankB - rankA; 
                        });
                        
                        animal.herdId = hId;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                const newId = this.nextHerdId++;
                this.herds.set(newId, [id]);
                animal.herdId = newId;
            }
        }
    }

    applyFlocking(myId, animal, transform, dt) {
        const members = this.herds.get(animal.herdId);
        if (!members || members.length <= 1) return;

        // 무리의 첫 번째 멤버를 리더로 지정 (죽으면 다음 멤버가 자동으로 리더가 됨)
        const leaderId = members[0];

        // 자신이 리더라면 누군가를 따라갈 필요 없이 자유롭게 배회함
        if (myId === leaderId) return;

        const em = this.engine.entityManager;
        const leaderEntity = em.entities.get(leaderId);
        const leaderTransform = leaderEntity?.components.get('Transform');
        if (!leaderTransform) return;

        // 리더의 AI 상태를 확인하여 위급 상황(flee) 전파
        const leaderState = leaderEntity.components.get('AIState');
        const myState = em.entities.get(myId)?.components.get('AIState');

        if (leaderState && myState) {
            if (leaderState.mode === 'flee' && myState.mode !== 'flee') {
                myState.mode = 'flee';
                myState.targetId = leaderState.targetId; // 포식자 정보 공유
            } else if (leaderState.mode === 'wander' && myState.mode === 'flee') {
                myState.mode = 'wander';
                myState.targetId = null;
            }
        }

        // 개체가 식사 중('eat')이거나 허기가 10% 이하로 떨어지면 무리 로직을 무시하고 생존에 집중
        const stats = em.entities.get(myId)?.components.get('BaseStats');
        if (myState && (myState.mode === 'eat' || (stats && stats.hunger <= 10))) {
            return;
        }

        const dx = leaderTransform.x - transform.x;
        const dy = leaderTransform.y - transform.y;
        const distSq = dx * dx + dy * dy;
        const timeScale = dt * 60;

        if (distSq > 900) {
            // 리더와 30px 이상 떨어지면 리더를 향해 이동 (Cohesion)
            transform.vx += dx * 0.05 * timeScale;
            transform.vy += dy * 0.05 * timeScale;
        } else {
            // 리더와 충분히 가까워지면 리더의 이동 방향과 속도를 따라함 (Alignment)
            transform.vx += ((leaderTransform.vx || 0) - transform.vx) * 0.1 * timeScale;
            transform.vy += ((leaderTransform.vy || 0) - transform.vy) * 0.1 * timeScale;
        }

        // Behavior: Social pause
        if (Math.random() < 0.001) {
            transform.vx *= 0.1;
            transform.vy *= 0.1;
        }
    }
}
