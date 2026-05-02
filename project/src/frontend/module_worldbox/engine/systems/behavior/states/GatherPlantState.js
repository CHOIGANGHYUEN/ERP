import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🧺 GatherPlantState
 * 채집가가 식물/열매를 채집하여 인벤토리에 넣는 상태입니다.
 * 채집 완료 후 식물은 소멸하며, 인벤토리가 꽉 차면 창고로 향합니다.
 */
export default class GatherPlantState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');

        if (!state || !transform || !inventory) return AnimalStates.IDLE;

        // 1. 인벤토리 체크
        if (inventory.getTotal() >= inventory.capacity) {
            state.targetId = null;
            return 'deposit';
        }

        const em = this.system.entityManager;
        const target = em.entities.get(state.targetId);

        // 2. 타겟 유효성 체크
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const tPos = target.components.get('Transform');
        const res = target.components.get('Resource');

        if (!tPos || !res || !res.edible || res.value <= 0) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 3. 거리 체크 및 이동
        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= 144) { // 12px 반경 (정밀 길찾기로 도달 가능)
            transform.vx = 0;
            transform.vy = 0;

            // 채집 시간 (0.8초)
            state.timer = (state.timer || 0) + dt;
            if (state.timer >= 0.8) {
                // 자원 수확 및 엔티티 제거
                const amount = res.value || 5;
                inventory.add('food', amount);

                // 파티클 효과 (잎사귀 비산)
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: tPos.x, y: tPos.y,
                    count: 5,
                    type: 'EFFECT',
                    color: '#4caf50',
                    speed: 2
                });

                // 🗑️ 식물 제거
                em.removeEntity(state.targetId);
                state.targetId = null;
                state.timer = 0;

                // 인벤토리 확인 후 계속할지 결정
                if (inventory.getTotal() >= inventory.capacity) return 'deposit';
                return AnimalStates.IDLE;
            }
        } else {
            // 이동
            Pathfinder.followPath(transform, state, tPos, 60, this.system.engine);
        }

        return null;
    }
}
