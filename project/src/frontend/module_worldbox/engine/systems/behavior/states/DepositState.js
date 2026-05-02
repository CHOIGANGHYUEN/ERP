import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

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

        // 1. 타겟 유효성 검사 및 목적지 검색 (마을 창고)
        let targetEntity = state.depositTargetId ? em.entities.get(state.depositTargetId) : null;

        if (!targetEntity && civ && civ.villageId !== -1) {
            // 현재 마을 소속 창고 건물 찾기 (가장 가까운 곳 기준)
            let closestStorageId = null;
            let minDist = Infinity;

            for (const bId of em.buildingIds) {
                const b = em.entities.get(bId);
                if (b && b.components.has('Storage')) {
                    const t = b.components.get('Transform');
                    const dSq = (t.x - transform.x) ** 2 + (t.y - transform.y) ** 2;
                    if (dSq < minDist) {
                        minDist = dSq;
                        closestStorageId = bId;
                    }
                }
            }
            if (closestStorageId) {
                state.depositTargetId = closestStorageId;
                targetEntity = em.entities.get(closestStorageId);
            }
        }

        if (!targetEntity) {
            // 반납할 곳을 찾지 못하면 보관 중인 자원을 포기하거나 파기함
            if (typeof inventory.clear === 'function') {
                inventory.clear();
            } else if (inventory.items instanceof Map) {
                inventory.items.clear();
            } else if (inventory.items) {
                Object.keys(inventory.items).forEach(k => delete inventory.items[k]);
            }
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

            // 마을 정보 조회 (자원 통계 동기화용)
            const vs = this.system.engine.systemManager?.villageSystem;
            const village = (vs && civ && civ.villageId !== -1) ? vs.getVillage(civ.villageId) : null;
            if (village && !village.resources) village.resources = { wood: 0, food: 0 };

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
            }

            // 인수인계 완료 후 개체의 인벤토리를 비움
            if (typeof inventory.clear === 'function') {
                inventory.clear();
            } else if (inventory.items instanceof Map) {
                inventory.items.clear();
            } else if (inventory.items) {
                Object.keys(inventory.items).forEach(k => delete inventory.items[k]);
            }
            state.depositTargetId = null;
            return AnimalStates.IDLE;
        } else {
            // 🚀 [2단계 대응] Pathfinder.followPath를 통해 이동 로직 처리
            const baseStats = entity.components.get('BaseStats');
            const speed = baseStats ? baseStats.speed * 50 : 60;

            // Pathfinder를 통해 이동 로직 처리
            const pathFound = Pathfinder.followPath(transform, state, targetPos, speed, this.system.engine);

            if (pathFound === -1) {
                // 🚧 도달할 수 없는 창고라면 이번 목표만 포기 (자원 증발 방지)
                // HumanBrain 로직에 의해 인벤토리가 차있으므로 다음 틱에 다른 경로를 찾게 됨
                state.depositTargetId = null;
                if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                return AnimalStates.IDLE;
            }
        }

        return null;
    }
}