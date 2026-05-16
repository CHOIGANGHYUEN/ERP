import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';
import BlueprintRegistry from '../../../data/BlueprintRegistry.js';

/**
 * 🔨 BuildState
 * 건축가가 "건물 바로 앞"에서 실제 건설 작업을 수행하는 순수 상태입니다.
 * 자원 조달은 더 이상 여기서 하지 않고, 브레인이 다른 상태(PICKUP, GATHER 등)를 통해 처리합니다.
 */
export default class BuildState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const em = this.system.entityManager;
        if (!state) return AnimalStates.IDLE;

        // 🛡️ [Busy Protection] 건설 작업 중에는 중단되지 않도록 보호
        state.interruptible = false;

        // 1. 타겟(청사진) 유효성 체크 및 요청
        let blueprintId = state.targetId;
        
        if (!blueprintId) {
            if (state.targetRequestFailed) {
                state.targetRequestFailed = false;
                state.isTargetRequested = false;
                return AnimalStates.IDLE;
            }

            if (!state.isTargetRequested) {
                const targetManager = this.system.engine.systemManager.targetManager;
                if (targetManager) {
                    targetManager.requestTarget(entityId, 'BLUEPRINT', {}, 'build');
                    state.isTargetRequested = true;
                }
            }
            
            // 대기 연출
            if (transform) {
                transform.vx *= 0.5;
                transform.vy *= 0.5;
            }
            return null; // 타겟이 할당될 때까지 대기
        }

        const blueprint = em.entities.get(blueprintId);
        const structure = blueprint?.components.get('Structure');

        if (!blueprint || !structure || !structure.isBlueprint || structure.isComplete) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 2. 🏃 건설지로 이동 및 작업 연출
        const bPos = blueprint.components.get('Transform');
        if (!bPos) return AnimalStates.IDLE;

        // 도착 여부 확인 (Pathfinder 사용, 40px 범위로 상향)
        const velocity = entity.components.get('Velocity');
        const isReached = Pathfinder.followPath(transform, state, bPos, 70, this.system.engine, 40, 2000, blueprintId, velocity);
        
        if (isReached === true) {
            // 도착 시 정지 및 연출 (실제 자원 소모와 진행도는 여기서 직접 처리하여 성능 확보)
            transform.vx = 0;
            transform.vy = 0;

            // 🚀 [Construction Logic] 건설 진행도 업데이트
            if (inventory) {
                const type = structure.type;
                const prog = structure.progress || 0;

                // 🏗️ [BlueprintRegistry] 현재 진행도에 맞는 필요 자원 결정 (ArchitectRole과 로직 동기화)
                const requiredType = BlueprintRegistry.getRequiredResource(type, prog);

                if (inventory.items[requiredType] >= 1) {
                    const builderComp = entity.components.get('Builder');
                    const buildSpeed = builderComp ? (builderComp.buildSpeed || 15) : 15;
                    const progressPerTick = buildSpeed * dt;

                    state._buildProgressCounter = (state._buildProgressCounter || 0) + progressPerTick;
                    
                    if (state._buildProgressCounter >= 10) {
                        const rt = this.system.engine.systemManager?.villageSystem?.resourceTransaction;
                        if (rt && rt.deposit(entity, blueprintId, requiredType, 1)) {
                            // 완공 체크 (deposit 내부에서 progress를 올려줌)
                            state._buildProgressCounter = 0;
                            if (structure.isComplete) {
                                const constructionSystem = this.system.engine.systemManager?.construction;
                                if (constructionSystem) {
                                    constructionSystem.finalizeBuilding(blueprint, blueprintId, structure);
                                }
                            }
                        }
                    }
                } else {
                    // 📢 [User Feedback] 자원 부족 시 말풍선으로 알림
                    const msg = `🚫 ${requiredType.toUpperCase()}?`;
                    this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: msg, duration: 2000 });

                    // 자원 부족 시 IDLE로 돌아가 Role이 재판단하게 함
                    state.mode = AnimalStates.IDLE;
                    state.targetId = null;
                    return AnimalStates.IDLE;
                }
            }

            state.animTimer = (state.animTimer || 0) + dt;
            if (state.animTimer >= 0.6) {
                // 🔨 망치질 연출
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: bPos.x + (Math.random() - 0.5) * 10,
                    y: bPos.y - 5,
                    count: 2, type: 'DUST', color: '#d2b48c'
                });
                state.animTimer = 0;
            }
        } else if (isReached === -1) {
            // 🔨 [Blueprint Fix] 청사진은 블랙리스트에 넣지 않고 타겟만 초기화 (재시도 허용)
            state.targetId = null;
            state.failedPathCount = 0;
            this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '🚫?', duration: 1000 });
            return AnimalStates.IDLE;
        }

        return null; // 상태 유지
    }
}
