import State from '../State.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

/**
 * 🚚 TransporterState
 * 창고 간 자원을 운반하여 물류 균형을 맞추는 상태입니다.
 */
export default class TransporterState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const em = this.system.entityManager;
        const economyManager = this.system.engine.systemManager.economyManager;

        if (!state || !inventory || !economyManager) return 'idle';

        // 1. 태스크가 없으면 요청
        if (!state.currentTaskId) {
            const task = economyManager.getAvailableTask(entityId);
            if (task) {
                state.currentTaskId = task.id;
                state.sourceId = task.sourceId;
                state.destId = task.destId;
                state.resourceType = task.resourceType;
                state.taskAmount = task.amount;
                state.transportPhase = 'GOING_TO_SOURCE';
            } else {
                return 'idle';
            }
        }

        // 2. 단계별 행동 수행
        switch (state.transportPhase) {
            case 'GOING_TO_SOURCE':
                return this._handleGoingToSource(entityId, entity, state, transform);
            case 'WITHDRAWING':
                return this._handleWithdrawing(entityId, entity, state, inventory);
            case 'GOING_TO_DEST':
                return this._handleGoingToDest(entityId, entity, state, transform);
            case 'DEPOSITING':
                return this._handleDepositing(entityId, entity, state, inventory, economyManager);
        }

        return null;
    }

    _handleGoingToSource(entityId, entity, state, transform) {
        const source = this.system.entityManager.entities.get(state.sourceId);
        if (!source) {
            state.currentTaskId = null;
            return 'idle';
        }
        const sPos = source.components.get('Transform');
        const isReached = Pathfinder.followPath(transform, state, sPos, 70, this.system.engine);
        if (isReached === true) {
            state.transportPhase = 'WITHDRAWING';
            state.waitTimer = 0;
        }
        return null;
    }

    _handleWithdrawing(entityId, entity, state, inventory) {
        const source = this.system.entityManager.entities.get(state.sourceId);
        const storage = source?.components.get('Storage');
        if (!storage) {
            state.currentTaskId = null;
            return 'idle';
        }

        state.waitTimer = (state.waitTimer || 0) + 0.1; // 시뮬레이션 상 시간 소요
        if (state.waitTimer >= 0.5) {
            const withdrawn = storage.withdraw(state.resourceType, state.taskAmount);
            if (withdrawn > 0) {
                inventory.add(state.resourceType, withdrawn);
                state.transportPhase = 'GOING_TO_DEST';
            } else {
                // 자원이 없으면 태스크 취소
                state.currentTaskId = null;
                return 'idle';
            }
        }
        return null;
    }

    _handleGoingToDest(entityId, entity, state, transform) {
        const dest = this.system.entityManager.entities.get(state.destId);
        if (!dest) {
            state.currentTaskId = null;
            return 'idle';
        }
        const dPos = dest.components.get('Transform');
        const isReached = Pathfinder.followPath(transform, state, dPos, 50, this.system.engine); // 짐이 무거우니 조금 천천히
        if (isReached === true) {
            state.transportPhase = 'DEPOSITING';
            state.waitTimer = 0;
        }
        return null;
    }

    _handleDepositing(entityId, entity, state, inventory, economyManager) {
        const dest = this.system.entityManager.entities.get(state.destId);
        const storage = dest?.components.get('Storage');
        if (!storage) {
            state.currentTaskId = null;
            return 'idle';
        }

        state.waitTimer = (state.waitTimer || 0) + 0.1;
        if (state.waitTimer >= 0.5) {
            const amountInHand = inventory.items[state.resourceType] || 0;
            const added = storage.addItem(state.resourceType, amountInHand);
            if (added > 0) {
                inventory.items[state.resourceType] -= added;
                if (inventory.items[state.resourceType] <= 0) {
                    economyManager.completeTask(state.currentTaskId);
                    state.currentTaskId = null;
                    return 'idle';
                }
            } else if (storage.isFull) {
                // 창고가 꽉 찼으면 주변에 버리거나 대기 (일단 완료 처리)
                economyManager.completeTask(state.currentTaskId);
                state.currentTaskId = null;
                return 'idle';
            }
        }
        return null;
    }
}
