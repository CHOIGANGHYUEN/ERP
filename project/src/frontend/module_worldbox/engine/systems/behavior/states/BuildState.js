import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

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
        const isReached = Pathfinder.followPath(transform, state, bPos, 70, this.system.engine, 40, 2000, blueprintId);
        
        if (isReached === true) {
            // 도착 시 정지 및 연출 (실제 자원 소모와 진행도는 ConstructionSystem에서 처리)
            transform.vx = 0;
            transform.vy = 0;

            state.animTimer = (state.animTimer || 0) + dt;
            if (state.animTimer >= 0.6) {
                // 🔨 망치질 먼지 효과
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: bPos.x + (Math.random() - 0.5) * 10,
                    y: bPos.y - 5,
                    count: 2, type: 'DUST', color: '#d2b48c'
                });

                // 💦 땀방울 효과 (파란색 작은 파티클)
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x, y: transform.y - 15,
                    count: 1, type: 'EFFECT', color: '#4fc3f7', speed: 0.5
                });

                if (Math.random() < 0.25) {
                    this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '🔨', duration: 500 });
                }
                state.animTimer = 0;
            }
        } else if (isReached === -1) {
            // 길찾기 실패 시 블랙리스트 등록 후 포기
            if (!state.unreachableTargets) state.unreachableTargets = new Set();
            state.unreachableTargets.add(blueprintId);
            state.targetId = null;
            this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '🚫?', duration: 1000 });
            return AnimalStates.IDLE;
        }

        return null; // 상태 유지
    }
}
