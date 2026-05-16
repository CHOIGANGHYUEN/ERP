import State from '../State.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

export default class ChiefExpandState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const velocity = entity.components.get('Velocity');
        const civ = entity.components.get('Civilization');
        
        if (!state || !transform || !state.wanderTarget) return 'idle';

        // 1. 목표 지점으로 이동
        const speed = 55;
        const isReached = Pathfinder.followPath(transform, state, state.wanderTarget, speed, this.system.engine, 20, 5000, null, velocity);

        if (isReached === true) {
            transform.vx = 0;
            transform.vy = 0;
            state.timer = (state.timer || 0) + dt;

            // 🚩 깃발 꽂기 애니메이션 (5초)
            if (state.timer >= 5.0) {
                const tm = this.system.engine.systemManager?.villageSystem?.territoryManager;
                if (tm) {
                    tm.claimTile(civ.villageId, state.wanderTarget.tx, state.wanderTarget.ty);
                }
                state.timer = 0;
                state.wanderTarget = null;
                return 'idle';
            }

            // 시각적 피드백 (반짝임)
            if (Math.random() < 0.1) {
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x, y: transform.y, count: 2, type: 'EFFECT', color: '#ffeb3b'
                });
            }
        } else if (isReached === -1) {
            state.wanderTarget = null;
            return 'idle';
        }

        return null;
    }
}
