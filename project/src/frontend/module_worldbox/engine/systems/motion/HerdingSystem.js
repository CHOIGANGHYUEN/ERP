import { AnimalStates } from '../../components/behavior/State.js';
import SpatialLODManager from './lod/SpatialLODManager.js';
import FlockingSolver from './physics/FlockingSolver.js';

/**
 * 🐏 HerdingSystem
 * 동물 개체들의 무리(Herd) 형성 및 사회적 행동(Boids, Leader Following)을 관리합니다.
 * 리팩토링을 통해 복잡한 연산 및 LOD 판별 로직을 lod/ 및 physics/ 모듈로 분리하였습니다.
 */
export default class HerdingSystem {
    constructor(engine) {
        this.engine = engine;
        this.herds = new Map(); // herdId -> [entityId, ...]
        this.nextHerdId = 1;
    }

    update(dt) {
        const em = this.engine.entityManager;

        // 1. [Maintenance] 죽은 멤버 제거 및 무리 데이터 청소
        for (const [hId, members] of this.herds) {
            const alive = members.filter(mid => em.entities.has(mid));
            if (alive.length === 0) {
                this.herds.delete(hId);
            } else {
                this.herds.set(hId, alive);
            }
        }

        const camera = this.engine?.camera;
        if (!camera) return;

        // 🚀 [Expert Optimization] 카메라 가시 영역 데이터 캡슐화
        const view = {
            x: camera.x - 50,
            y: camera.y - 50,
            w: (this.engine.width / camera.zoom) + 100,
            h: (this.engine.height / camera.zoom) + 100
        };
        const frameCount = this.engine.frameCount || 0;

        // 2. [Social Logic] 동물 개체별 무리 형성 및 상태 전파
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            
            const animal = entity.components.get('Animal');
            const transform = entity.components.get('Transform');
            
            // 👤 인간은 독립적 행동을 하므로 사회적 무리 연산에서 제외
            if (animal && animal.type === 'human') continue;

            if (animal && transform) {
                // 🚀 [Spatial LOD] 원거리 개체는 허딩 연산을 완전히 생략하여 O(N^2) 부하 방지
                if (SpatialLODManager.shouldSkipHerding(id, transform.x, transform.y, view, frameCount)) continue;

                // 무리 할당 및 리더 추종 상태 동기화 (전략 객체 위임)
                this.maintainHerd(id, animal);
                FlockingSolver.updateHerdStatus(id, animal, this.herds, em);
                
                // 🕊️ [Boids Integration] 필요 시 여기서 FlockingSolver.resolveBoids(id, ...) 호출 가능
            }
        }
    }

    /** 🐏 [Maintenance] 종족별 무리 크기 제한 및 서열(Rank)에 따른 리더 선출 */
    maintainHerd(id, animal) {
        const config = this.engine.speciesConfig[animal.type] || {};
        const limit = config.herdLimit || 20;

        if (animal.herdId === undefined || animal.herdId === -1) {
            let found = false;
            for (const [hId, members] of this.herds) {
                if (members.length < limit && members.length > 0) {
                    const em = this.engine.entityManager;
                    const leaderAnimal = em.entities.get(members[0])?.components.get('Animal');
                    
                    // 같은 종족끼리만 무리 형성
                    if (leaderAnimal && leaderAnimal.type === animal.type) {
                        members.push(id);
                        // 🐺 서열(Rank) 기반 정렬: 가장 강한 개체가 0번 인덱스(리더)가 됨
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
}
