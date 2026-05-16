import State from '../State.js';
import Pathfinder from '../../../../utils/Pathfinder.js';

export default class ChiefDispatchState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const velocity = entity.components.get('Velocity');
        if (!state || !transform) return 'idle';

        const order = state.dispatchOrder;
        const worker = order ? this.system.entityManager.entities.get(order.workerId) : null;
        const workerPos = worker?.components.get('Transform');
        if (!order || !workerPos) {
            state.dispatchOrder = null;
            return 'idle';
        }

        const reached = Pathfinder.followPath(transform, state, workerPos, 55, this.system.engine, 36, 4000, worker.id, velocity);
        if (reached === true || reached === -1) {
            transform.vx = 0;
            transform.vy = 0;
            state.dispatchTimer = (state.dispatchTimer || 0) + dt;

            if (!state.dispatchAnnounced) {
                state.dispatchAnnounced = true;
                this.system.eventBus?.emit('SHOW_SPEECH_BUBBLE', {
                    entityId,
                    text: `Move ${order.resourceType}`,
                    duration: 1600
                });
            }

            if (state.dispatchTimer >= 1.4) {
                state.dispatchTimer = 0;
                state.dispatchAnnounced = false;
                state.dispatchOrder = null;
                state.targetId = null;
                return 'idle';
            }
        }

        return null;
    }
}
