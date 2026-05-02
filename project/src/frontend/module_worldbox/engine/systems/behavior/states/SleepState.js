import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';

export default class SleepState extends State {
    update(entityId, entity, dt) {
        const stats = entity.components.get('BaseStats');
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');

        if (!stats) return AnimalStates.IDLE;

        // 1. 수면 중에는 이동 정지
        transform.vx = 0;
        transform.vy = 0;

        // 2. 피로도 회복 (수면 시에는 빠르게 회복)
        stats.fatigue = Math.max(0, stats.fatigue - dt * 15);
        
        // 3. 체력 소폭 회복 (수면 효과)
        if (stats.health < stats.maxHealth) {
            stats.health = Math.min(stats.maxHealth, stats.health + dt * 2);
        }

        // 4. 피로도가 충분히 회복되면 깨어남
        if (stats.fatigue <= 5) {
            if (state.popMode) {
                state.popMode();
                return state.mode;
            }
            return AnimalStates.IDLE;
        }

        return null;
    }

    enter(entityId, entity) {
        const visual = entity.components.get('Visual');
        if (visual) visual.isSleeping = true;
    }

    exit(entityId, entity) {
        const visual = entity.components.get('Visual');
        if (visual) visual.isSleeping = false;
    }
}
