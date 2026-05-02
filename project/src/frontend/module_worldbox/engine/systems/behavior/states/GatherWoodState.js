import State from './State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🪓 GatherWoodState
 * 인간이 나무를 찾아가 도끼로 패고 목재를 수집하는 상태입니다.
 * 나무는 도끼질이 완료되면 쓰러지는 애니메이션과 함께 제거됩니다.
 */
export default class GatherWoodState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');

        // 인벤토리가 꽉 찼으면 복귀
        if (!inventory || inventory.getTotal() >= inventory.capacity) {
            state.targetId = null;
            state.isChopping = false;
            return 'idle';
        }

        const em = this.system.entityManager;
        const engine = this.system.engine;

        // 1. 나무 탐색 (SpatialHash 활용)
        if (!state.targetId) {
            let nearestId = null;
            let minDistSq = Infinity;

            // SpatialHash로 가까운 반경 내 탐색
            const spatialHash = engine.spatialHash;
            const nearbyIds = spatialHash
                ? spatialHash.query(transform.x, transform.y, 400)
                : Array.from(em.resourceIds);

            for (const id of nearbyIds) {
                const targetEntity = em.entities.get(id);
                if (!targetEntity) continue;
                const res = targetEntity.components.get('Resource');
                if (!res || !res.isTree || res.value <= 0) continue;
                // 이미 다른 벌목꾼이 패고 있는 나무는 피하기
                if (res.isFalling) continue;

                const tPos = targetEntity.components.get('Transform');
                if (!tPos) continue;
                const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }

            if (nearestId) {
                state.targetId = nearestId;
                state.chopTimer = 0;
                state.isChopping = false;
            } else {
                return 'idle'; // 주변에 나무가 없으면 대기
            }
        }

        const target = em.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            state.isChopping = false;
            return null;
        }

        const tPos = target.components.get('Transform');
        const res = target.components.get('Resource');

        if (!tPos || !res || res.value <= 0) {
            state.targetId = null;
            state.isChopping = false;
            return null;
        }

        // 2. 이동 또는 도끼질
        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= 144) { // 반경 12px — 나무 앞에 도달
            // 멈추고 도끼질 시작
            transform.vx *= 0.5;
            transform.vy *= 0.5;
            state.isChopping = true;

            // 도끼질 타이머 (0.4초마다 한 번 타격)
            state.chopTimer = (state.chopTimer || 0) + dt;
            const chopInterval = 0.4;

            if (state.chopTimer >= chopInterval) {
                state.chopTimer = 0;

                // 타격 1회당 나무 체력 감소
                const damage = 8 + Math.random() * 4; // 8~12
                res.value -= damage;

                // 🪵 도끼질 파티클 (나무 조각 비산)
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: tPos.x, y: tPos.y - 5,
                    count: 3,
                    type: 'EFFECT',
                    color: '#795548',
                    speed: 3
                });

                // 나무가 다 떨어지면 쓰러짐 처리
                if (res.value <= 0) {
                    res.value = 0;
                    res.isFalling = true; // 쓰러지는 애니메이션 트리거
                    res.fallProgress = 0; // 쓰러짐 진행도 (0→1)
                    res.fallDirection = dx >= 0 ? 1 : -1; // 벌목꾼 반대 방향으로 쓰러짐

                    // 목재 인벤토리에 추가
                    const woodGained = 5 + Math.floor(Math.random() * 3);
                    inventory.add('wood', woodGained);

                    // 쓰러지는 큰 파티클 + 먼지
                    this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: tPos.x, y: tPos.y,
                        count: 15,
                        type: 'EFFECT',
                        color: '#5d4037',
                        speed: 5
                    });
                    this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: tPos.x, y: tPos.y,
                        count: 10,
                        type: 'DUST',
                        color: '#bcaaa4',
                        speed: 2
                    });

                    state.targetId = null;
                    state.isChopping = false;
                    return null;
                }
            }

        } else {
            // 이동 (경로 탐색 적용)
            state.isChopping = false;
            Pathfinder.followPath(transform, state, tPos, 55, this.system.engine);
        }

        return null;
    }
}
