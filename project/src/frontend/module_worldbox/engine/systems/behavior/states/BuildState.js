import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🔨 BuildState
 * 건축가가 자원을 조달하고 청사진(Blueprint)에서 건설을 수행하는 상태입니다.
 */
export default class BuildState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const em = this.system.entityManager;
        if (!state) return AnimalStates.IDLE;

        // 1. 건설할 청사진(Blueprint) 탐색
        if (!state.targetId) {
            if (state.targetRequestFailed) {
                state.retryTimer = (state.retryTimer || 0) + dt;
                if (state.retryTimer >= 3.0) {
                    state.targetRequestFailed = false;
                    state.isTargetRequested = false;
                    state.retryTimer = 0;
                }
                return null;
            }

            if (!state.isTargetRequested) {
                const targetManager = this.system.engine.systemManager.targetManager;
                if (targetManager) {
                    targetManager.requestTarget(entityId, 'BLUEPRINT', {}, 'build');
                    state.isTargetRequested = true;
                }
            }
            return null;
        }

        const blueprint = em.entities.get(state.targetId);
        const structure = blueprint?.components.get('Structure');

        if (!blueprint || !structure || !structure.isBlueprint) {
            state.targetId = null;
            state.buildPhase = 'CHECK_RESOURCES';
            return null;
        }

        // 🏗️ 건설 단계 관리
        if (!state.buildPhase) state.buildPhase = 'CHECK_RESOURCES';

        switch (state.buildPhase) {
            case 'CHECK_RESOURCES':
                return this._handleCheckResources(entityId, entity, state, inventory, dt);
            case 'GOING_TO_STORAGE':
                return this._handleGoingToStorage(entityId, entity, state, transform);
            case 'WITHDRAWING':
                return this._handleWithdrawing(entityId, entity, state, inventory, dt);
            case 'GOING_TO_BLUEPRINT':
                return this._handleGoingToBlueprint(entityId, entity, state, transform, blueprint);
        }

        return null;
    }

    _handleCheckResources(entityId, entity, state, inventory, dt) {
        // 건설에 필요한 자원(나무 등)이 인벤토리에 충분한지 확인
        const woodCount = inventory.items['wood'] || 0;
        if (woodCount < 5) {
            // 자원 부족 -> 창고 탐색 요청
            if (state.targetRequestFailed) {
                state.retryTimer = (state.retryTimer || 0) + dt;
                if (state.retryTimer >= 3.0) {
                    state.targetRequestFailed = false;
                    state.isTargetRequested = false;
                    state.retryTimer = 0;
                }
                return null;
            }

            if (!state.isTargetRequested && !state.storageTargetId) {
                const targetManager = this.system.engine.systemManager.targetManager;
                const blackboard = this.system.engine.systemManager.blackboard;
                const totalWood = (blackboard.storages || []).reduce((sum, s) => sum + (s.items['wood'] || 0), 0);
                
                if ((blackboard.storages || []).length === 0 || totalWood < 5) {
                    // ⏳ 마을에 자원이 부족해도 즉시 포기하지 않고 '대기' (10초 유예)
                    state.waitTimer = (state.waitTimer || 0) + dt;
                    if (state.waitTimer < 10.0) {
                        if (Math.random() < 0.01) {
                            this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '🪵?', duration: 1000 });
                        }
                        return null; // 대기 유지
                    }
                    
                    state.isTargetRequested = false;
                    state.targetId = null;
                    return AnimalStates.IDLE;
                }

                if (targetManager) {
                    targetManager.requestTarget(entityId, 'STORAGE_WITHDRAW', { resourceType: 'wood', amount: 20 }, 'build');
                    state.isTargetRequested = true;
                    state.waitTimer = 0;
                }
            }

            // TargetManager가 storageTargetId를 주입해줄 때까지 대기하거나 이미 있다면 이동
            if (state.storageTargetId) {
                state.buildPhase = 'GOING_TO_STORAGE';
            }
            return null;
        }
        state.buildPhase = 'GOING_TO_BLUEPRINT';
        return null;
    }

    _handleGoingToStorage(entityId, entity, state, transform) {
        const storageId = state.storageTargetId;
        const storage = this.system.entityManager.entities.get(storageId);
        if (!storage) {
            state.isTargetRequested = false;
            state.storageTargetId = null;
            state.buildPhase = 'CHECK_RESOURCES';
            return null;
        }
        const sPos = storage.components.get('Transform');
        const isReached = Pathfinder.followPath(transform, state, sPos, 80, this.system.engine);
        if (isReached === true) {
            state.buildPhase = 'WITHDRAWING';
            state.waitTimer = 0;
        }
        return null;
    }

    _handleWithdrawing(entityId, entity, state, inventory, dt) {
        const storageEnt = this.system.entityManager.entities.get(state.storageTargetId);
        const storage = storageEnt?.components.get('Storage');
        if (!storage) {
            state.storageTargetId = null;
            state.buildPhase = 'CHECK_RESOURCES';
            return null;
        }

        state.waitTimer = (state.waitTimer || 0) + dt;
        if (state.waitTimer >= 0.5) {
            const withdrawn = storage.withdraw('wood', 20);
            if (withdrawn > 0) {
                inventory.add('wood', withdrawn);
                state.storageTargetId = null; // 사용 완료
                state.isTargetRequested = false;
                state.buildPhase = 'GOING_TO_BLUEPRINT';
            } else {
                state.isTargetRequested = false;
                state.storageTargetId = null;
                state.buildPhase = 'CHECK_RESOURCES';
            }
        }
        return null;
    }

    _handleGoingToBlueprint(entityId, entity, state, transform, blueprint) {
        const bPos = blueprint.components.get('Transform');
        if (!bPos) return AnimalStates.IDLE;

        const isReached = Pathfinder.followPath(transform, state, bPos, 70, this.system.engine);
        if (isReached === true) {
            transform.vx = 0;
            transform.vy = 0;
            return null; // 도착
        } else if (isReached === -1) {
            // 🚫 도달 불가능한 청사진 블랙리스트 등록
            if (!state.unreachableTargets) state.unreachableTargets = new Set();
            state.unreachableTargets.add(state.targetId);
            
            state.targetId = null;
            return AnimalStates.IDLE;
        }
        return null;
    }
}
