import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import { GlobalLogger } from '../../../utils/Logger.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 📦 WithdrawState
 * 창고(Storage)에서 필요한 자원을 꺼내오는 상태입니다.
 */
export default class WithdrawState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const em = this.system.entityManager;

        const target = em.entities.get(state.targetId);
        if (!target || !transform || !inventory) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const tPos = target.components.get('Transform');
        const storage = target.components.get('Storage');

        if (!tPos || !storage) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 사거리 내에 도달했는지 확인 (40px -> 1600 sq)
        if (distSq <= 1600) {
            transform.vx *= 0.5;
            transform.vy *= 0.5;

            const reqType = state.targetResourceType || 'wood';
            const amountInStorage = storage.items[reqType] || 0;

            if (amountInStorage > 0) {
                // 한 번에 최대 5개씩 가져옴
                const takeAmount = Math.min(5, amountInStorage, inventory.capacity - inventory.getTotal());
                if (takeAmount > 0) {
                    storage.items[reqType] -= takeAmount;
                    inventory.items[reqType] = (inventory.items[reqType] || 0) + takeAmount;
                    
                    GlobalLogger.info(`📦 [Withdraw] Entity ${entityId} took ${takeAmount} ${reqType} from storage.`);
                    
                    if (this.system.eventBus) {
                        this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '📦', duration: 1000 });
                        this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y - 10, count: 3, type: 'DUST', color: '#fff'
                        });
                    }
                }
            }

            state.targetId = null;
            return AnimalStates.IDLE; // 인벤토리를 채웠으니 다음 판단을 기다림
        } else {
            // 이동
            const speed = 60;
            if (Pathfinder.followPath(transform, state, tPos, speed, this.system.engine, 40) === -1) {
                state.targetId = null;
                return AnimalStates.IDLE;
            }
        }

        return null;
    }
}
