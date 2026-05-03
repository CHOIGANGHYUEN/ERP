import { AnimalStates } from '../../components/behavior/State.js';

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

        // 2. Assign herds & apply flocking (동물 개체만 선별하여 처리)
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            
            const animal = entity.components.get('Animal');
            const transform = entity.components.get('Transform');
            
            // 👤 인간은 사회적 무리(flocking) 로직에서 제외하여 독립성 보장
            if (animal && animal.type === 'human') continue;

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

        const em = this.engine.entityManager;
        const myState = em.entities.get(myId)?.components.get('AIState');

        // 🛑 [Expert Update] IDLE 상태인 개체는 무리 이동 로직을 적용하지 않음 (완전 정지 보장)
        if (myState && myState.mode === AnimalStates.IDLE) {
            return;
        }

        // 무리의 첫 번째 멤버를 리더로 지정 (죽으면 다음 멤버가 자동으로 리더가 됨)
        const leaderId = members[0];

        // 인간(human)은 무리 추종 로직에서 제외 (각자 독립적 행동)
        const animalComp = em.entities.get(myId)?.components.get('Animal');
        if (animalComp && animalComp.type === 'human') return;

        // 자신이 리더라면 누군가를 따라갈 필요 없이 자유롭게 배회함
        if (myId === leaderId) return;

        const leaderEntity = em.entities.get(leaderId);
        const leaderTransform = leaderEntity?.components.get('Transform');
        if (!leaderTransform) return;

        // 리더의 AI 상태를 확인하여 위급 상황(flee) 전파
        const leaderState = leaderEntity.components.get('AIState');

        if (leaderState && myState) {
            if (leaderState.mode === 'flee' && myState.mode !== 'flee') {
                myState.mode = 'flee';
                myState.targetId = leaderState.targetId; // 포식자 정보 공유
            } else if (leaderState.mode === 'wander' && myState.mode === 'flee') {
                myState.mode = 'wander';
                myState.targetId = null;
            }
        }

        const stats = em.entities.get(myId)?.components.get('BaseStats');

        // 🥗 [Survival Priority] 식사 중이거나, 먹이를 찾는 중이거나, 허기가 임계치(60) 이하인 경우 무리 로직 차단
        const isSearchingFood = myState && (myState.mode === AnimalStates.EAT || myState.mode === AnimalStates.FORAGE || myState.mode === AnimalStates.HUNT);
        const isHungry = stats && stats.hunger < 60;

        if (isSearchingFood || isHungry) {
            return;
        }

        // 🛑 [Legacy Cleanup] Pathfinder 없이 속도를 직접 조작하던 로직 제거
        // 이제 모든 배회 및 이동은 WanderState 등에서 Pathfinder를 통해 정식으로 수행됩니다.
        return;
    }
}
