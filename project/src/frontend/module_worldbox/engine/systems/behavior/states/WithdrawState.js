import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

export default class WithdrawState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const civ = entity.components.get('Civilization');
        const em = this.system.entityManager;
        const logistics = this.system.engine.systemManager?.villageSystem?.logisticsMediator;

        if (!state || !transform || !inventory) return AnimalStates.IDLE;
        state.interruptible = false;

        const reqType = state.targetResourceType || 'wood';
        const amount = Math.max(1, state.logisticsAmount || 5);

        if (!state.targetId || !logistics?.isStorageUsable(state.targetId, false, reqType)) {
            const nextId = logistics && civ
                ? logistics.findStorageForWithdraw(civ.villageId, reqType, 1, transform, { excludeId: state.targetId })
                : null;
            state.targetId = nextId;
            state.path = null;
            if (!nextId) return AnimalStates.IDLE;
        }

        const target = em.entities.get(state.targetId);
        const targetPos = target?.components.get('Transform');
        const storage = target?.components.get('Storage');

        if (!target || !targetPos || !storage) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const dx = targetPos.x - transform.x;
        const dy = targetPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 1600) {
            const speed = 60;
            const velocity = entity.components.get('Velocity');
            if (Pathfinder.followPath(transform, state, targetPos, speed, this.system.engine, 40, null, null, velocity) === -1) {
                state.targetId = null;
                return AnimalStates.IDLE;
            }
            return null;
        }

        transform.vx *= 0.5;
        transform.vy *= 0.5;

        const transaction = this.system.engine.systemManager?.villageSystem?.resourceTransaction;
        const ok = transaction?.withdraw(entity, target.id, reqType, Math.min(amount, inventory.capacity - inventory.getTotal()));

        if (ok) {
            this.system.eventBus?.emit('SHOW_SPEECH_BUBBLE', { entityId, text: 'Load', duration: 1000 });
            this.system.eventBus?.emit('SPAWN_EFFECT_PARTICLES', {
                x: transform.x,
                y: transform.y - 10,
                count: 3,
                type: 'DUST',
                color: '#fff'
            });
        }

        if (state.logisticsDestStorageId) {
            state.targetId = state.logisticsDestStorageId;
            state.logisticsDestStorageId = null;
            state.path = null;
            return 'deposit';
        }

        state.targetId = null;
        return AnimalStates.IDLE;
    }
}
