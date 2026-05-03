import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 📦 PickupState
 * 바닥에 드랍된 아이템(DroppedItem)을 탐색하여 이동하고, 
 * 도달 시 인벤토리에 추가하는 상태입니다.
 */
export default class PickupState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');

        if (!state || !transform || !inventory) return AnimalStates.IDLE;

        // 1. 인벤토리 체크 (이미 가득 찼으면 취소)
        if (inventory.getTotal() >= inventory.capacity) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 2. 타겟 유효성 체크
        const em = this.system.entityManager;
        const target = em.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const item = target.components.get('DroppedItem');
        const tPos = target.components.get('Transform');

        if (!item || !tPos) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 🔒 [DroppedItem Claiming] 다른 사람이 주우러 오고 있는지 체크
        if (item.claimedBy && item.claimedBy !== entityId) {
            const claimer = em.entities.get(item.claimedBy);
            const claimerState = claimer?.components.get('AIState');
            if (claimerState && claimerState.targetId === state.targetId) {
                state.targetId = null; // 양보
                return AnimalStates.IDLE;
            }
            item.claimedBy = null;
        }
        item.claimedBy = entityId;

        // 3. 거리 체크
        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= 400) { // 20px 이내 (충분히 가까움 - 길찾기 정지 거리 12px보다 큼)
            transform.vx = 0;
            transform.vy = 0;

            // 🧺 아이템 줍기
            const added = inventory.add(item.itemType, item.amount);

            if (added >= item.amount) {
                // 전체 획득 완료
                em.removeEntity(state.targetId);
                state.targetId = null;
            } else {
                // 일부만 획득 (인벤토리 부족)
                item.amount -= added;
                state.targetId = null; // 일단 중단
            }

            // 시각 효과
            if (this.system.eventBus) {
                const emojiMap = {
                    'wood': '🪵', 'stone': '🪨', 'meat': '🥩',
                    'fruit': '🍎', 'grass': '🌾', 'food': '🍖', 'gold': '🟡',
                    'coal': '⬛', 'iron_ore': '⛓️'
                };
                const emoji = emojiMap[item.itemType] || '📦';

                this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: `+${added} ${emoji}`, duration: 1000 });
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x, y: transform.y, count: 3, type: 'DUST', color: '#fff'
                });
            }

            return AnimalStates.IDLE;
        } else {
            // 이동
            const stats = entity.components.get('BaseStats');
            const speed = (stats?.speed || 40);

            if (Pathfinder.followPath(transform, state, tPos, speed, this.system.engine) === -1) {
                state.targetId = null;
                return AnimalStates.IDLE;
            }
        }

        return null;
    }
}
