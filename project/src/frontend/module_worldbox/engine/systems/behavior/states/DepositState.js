import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 📦 DepositState
 * 인벤토리가 꽉 찬 개체가 마을의 창고(Storage)로 복귀하여 자원을 반납하는 상태입니다.
 */
export default class DepositState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const civ = entity.components.get('Civilization');

        // 인벤토리가 비어있거나 필수 컴포넌트가 없으면 바로 IDLE 상태로 전환
        if (!state || !transform || !inventory || inventory.getTotal() === 0) {
            return AnimalStates.IDLE;
        }

        const em = this.system.entityManager;

        // 1. 타겟 유효성 검사 및 목적지 검색 (중앙 관제 요청)
        if (!state.targetId) {
            if (state.targetRequestFailed) {
                state.targetRequestFailed = false;
                // 창고를 못 찾아도 자원을 파기하지 않고 일단 IDLE로 돌아가 다른 판단(건설 등)을 기다림
                return AnimalStates.IDLE;
            }

            if (!state.isTargetRequested) {
                const targetManager = this.system.engine.systemManager.targetManager;
                if (targetManager) {
                    targetManager.requestTarget(entityId, 'STORAGE_DEPOSIT', {}, 'deposit');
                    state.isTargetRequested = true;
                }
            }
            return null; // 타겟 할당될 때까지 대기
        }

        let targetEntity = em.entities.get(state.targetId);

        if (!targetEntity) {
            // 반납할 곳이 사라졌더라도 자원은 보존하고 IDLE로 복귀
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const targetPos = targetEntity.components.get('Transform');
        const dx = targetPos.x - transform.x;
        const dy = targetPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 2. 이동 및 반납 거리 판정 (반경 40px -> 1600 sq)
        if (distSq <= 1600) {
            transform.vx = 0;
            transform.vy = 0;

            // 📦 창고(Storage) 컴포넌트로 아이템 인수인계
            const storage = targetEntity.components.get('Storage');
            const depositedItemsText = [];
            if (storage && inventory.items) {
                const itemsToTransfer = inventory.items instanceof Map
                    ? Array.from(inventory.items.entries())
                    : Object.entries(inventory.items);

                const emojiMap = {
                    'wood': '🪵',
                    'food': '🍖',
                    'stone': '🪨',
                    'meat': '🥩',
                    'berry': '🫐',
                    'wheat': '🌾'
                };

                for (const [resType, amount] of itemsToTransfer) {
                    if (amount > 0) {
                        // 안전한 자원 추가 (storage.add 함수가 없으면 직접 객체 프로퍼티 증가)
                        if (typeof storage.add === 'function') {
                            storage.add(resType, amount);
                        } else if (storage.items) {
                            storage.items[resType] = (storage.items[resType] || 0) + amount;
                        }

                        const emoji = emojiMap[resType.toLowerCase()] || '📦';
                        depositedItemsText.push(`+${amount} ${emoji} ${resType.toUpperCase()}`);
                    }
                }
            }

            // 💬 납부한 자원이 있다면 말풍선(플로팅 텍스트) 이벤트 발생
            if (depositedItemsText.length > 0 && this.system.eventBus) {
                this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', {
                    entityId: entityId,
                    text: depositedItemsText.join(', '),
                    type: 'deposit', // UI에서 색상 등을 구분하기 위한 타입 지정
                    duration: 2000
                });
                
                GlobalLogger.success(`Citizen ${entityId} deposited resources: ${depositedItemsText.join(', ')}`);
            }

            // 인수인계 완료 후 개체의 인벤토리를 비움
            if (typeof inventory.clear === 'function') {
                inventory.clear();
            } else if (inventory.items instanceof Map) {
                inventory.items.clear();
            } else if (inventory.items) {
                Object.keys(inventory.items).forEach(k => delete inventory.items[k]);
            }
            state.targetId = null;
            if (state.unreachableTargets) state.unreachableTargets.clear();
            return AnimalStates.IDLE;
        } else {
            // 🚀 [2단계 대응] Pathfinder.followPath를 통해 이동 로직 처리
            const baseStats = entity.components.get('BaseStats');
            const speed = baseStats ? baseStats.speed * 50 : 60;

            // Pathfinder를 통해 이동 로직 처리
            const pathFound = Pathfinder.followPath(transform, state, targetPos, speed, this.system.engine);

            if (pathFound === -1) {
                // 🚧 도달할 수 없는 창고라면 이번 목표만 포기 (자원 증발 방지)
                state.targetId = null;
                if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                return AnimalStates.IDLE;
            }
        }

        return null;
    }
}