import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';
import { GlobalLogger } from '../../../utils/Logger.js';

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

        // 2. 타겟 유효성 체크 및 탐색 요청
        if (!state.targetId) {
            if (state.targetRequestFailed) {
                state.retryTimer = (state.retryTimer || 0) + dt;
                if (state.retryTimer >= 2.0) {
                    state.targetRequestFailed = false;
                    state.isTargetRequested = false;
                    state.retryTimer = 0;
                }
                if (transform) {
                    transform.vx *= 0.5;
                    transform.vy *= 0.5;
                }
                return null;
            }

            if (!state.isTargetRequested) {
                const targetManager = this.system.engine.systemManager.targetManager;
                if (targetManager) {
                    const reqType = state.targetResourceType || 'food';
                    targetManager.requestTarget(entityId, 'RESOURCE', { resourceType: reqType }, 'gather_plant');
                    state.isTargetRequested = true;
                }
            }
            
            // ⏳ 내부 대기 연출
            if (transform) {
                transform.vx *= 0.5;
                transform.vy *= 0.5;
            }
            return null; // gather_plant 상태 유지
        }

        const em = this.system.entityManager;
        const target = em.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const tPos = target.components.get('Transform');
        const res = target.components.get('Resource');

        if (!tPos || !res || res.value <= 0) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 🔒 식물 독점 (Claim) 체크: 이미 다른 사람이 찜해서 오고 있는지 확인
        if (res.claimedBy && res.claimedBy !== entityId) {
            const claimer = em.entities.get(res.claimedBy);
            const claimerState = claimer?.components.get('AIState');
            if (claimerState && claimerState.targetId === state.targetId) {
                state.targetId = null; // 다른 개체가 캐러 오고 있으므로 양보
                if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                return AnimalStates.IDLE;
            }
            res.claimedBy = null;
        }
        res.claimedBy = entityId; // 내가 찜함

        // 3. 거리 체크 및 이동
        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= 225) { // 15px 반경 (길찾기 정지 거리 12px보다 여유 있게 설정)
            transform.vx = 0;
            transform.vy = 0;

            // 채집 시간 (0.8초)
            state.timer = (state.timer || 0) + dt;
            if (state.timer >= 0.8) {
                // 📦 [User Request] 인벤토리에 즉시 넣지 않고 바닥에 드랍함
                const itemFactory = this.system.engine.factoryProvider.getFactory('item');
                if (itemFactory && tPos) {
                    const dropType = res.type || 'food';
                    const amountGained = 5 + Math.floor(Math.random() * 3);
                    itemFactory.spawnDrop(tPos.x, tPos.y, dropType, amountGained);
                    GlobalLogger.info(`Citizen ${entityId} harvested ${dropType.toUpperCase()}.`);
                }

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
                return 'gather_plant'; // 🌿 [Success] 다음 타겟 탐색을 위해 상태 유지
            }
        } else {
            // 이동
            if (Pathfinder.followPath(transform, state, tPos, 60, this.system.engine) === -1) {
                // 도달할 수 없는 식물일 경우 즉시 채집 포기
                state.targetId = null;
                if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                return AnimalStates.IDLE;
            }
        }

        return null;
    }
}
