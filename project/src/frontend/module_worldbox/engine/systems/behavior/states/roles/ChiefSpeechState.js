import State from '../State.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

export default class ChiefSpeechState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const velocity = entity.components.get('Velocity');
        if (!state || !transform) return 'idle';

        const target = this._resolveSpeechTarget(state);
        const reached = Pathfinder.followPath(transform, state, target, 55, this.system.engine, 28, 4000, null, velocity);

        if (reached === -1 || reached === true) {
            transform.vx = 0;
            transform.vy = 0;
            state.speechTimer = (state.speechTimer || 0) + dt;

            if (!state.speechAnnounced) {
                state.speechAnnounced = true;
                this.system.eventBus?.emit('SHOW_SPEECH_BUBBLE', {
                    entityId,
                    text: state.speechText || 'Nation',
                    duration: 2200
                });
            }

            if (Math.random() < 0.12) {
                this.system.eventBus?.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x + (Math.random() - 0.5) * 18,
                    y: transform.y - 16,
                    count: 2,
                    type: 'EFFECT',
                    color: '#ffd54f',
                    speed: 1.0
                });
            }

            if (state.speechTimer >= 3.0) {
                state.speechTarget = null;
                state.speechTimer = 0;
                state.speechAnnounced = false;
                state.targetId = null;
                return 'idle';
            }
        }

        return null;
    }

    _resolveSpeechTarget(state) {
        if (state.speechTarget) return state.speechTarget;

        const target = state.targetId
            ? this.system.entityManager.entities.get(state.targetId)?.components.get('Transform')
            : null;
        return target || { x: 0, y: 0 };
    }
}
