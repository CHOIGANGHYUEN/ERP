import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';
import { GlobalLogger } from '../../../utils/Logger.js';

export default class DepositState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const civ = entity.components.get('Civilization');

        if (!state || !transform || !inventory || inventory.getTotal() === 0) {
            return AnimalStates.IDLE;
        }

        state.interruptible = false;

        const logistics = this.system.engine.systemManager?.villageSystem?.logisticsMediator;
        const carriedType = this._firstInventoryType(inventory);

        if (!state.targetId) {
            const preferredId = state.logisticsDestStorageId || null;
            const directId = logistics && civ
                ? logistics.findStorageForDeposit(civ.villageId, carriedType, inventory.getTotal(), transform, { preferredId })
                : null;

            if (directId) {
                state.targetId = directId;
                state.isTargetRequested = false;
            } else if (state.targetRequestFailed) {
                state.targetRequestFailed = false;
                return AnimalStates.IDLE;
            } else if (!state.isTargetRequested) {
                this.system.engine.systemManager.targetManager?.requestTarget(
                    entityId,
                    'STORAGE_DEPOSIT',
                    { targetType: 'STORAGE_DEPOSIT', resourceType: carriedType },
                    'deposit'
                );
                state.isTargetRequested = true;
            }
            return null;
        }

        const em = this.system.entityManager;
        let targetEntity = em.entities.get(state.targetId);
        if (!targetEntity || !logistics?.isStorageUsable(state.targetId, true, carriedType)) {
            const nextId = logistics && civ
                ? logistics.findStorageForDeposit(civ.villageId, carriedType, inventory.getTotal(), transform, { excludeId: state.targetId })
                : null;
            state.targetId = nextId;
            state.path = null;
            return nextId ? null : AnimalStates.IDLE;
        }

        const targetPos = targetEntity.components.get('Transform');
        if (!targetPos) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const dx = targetPos.x - transform.x;
        const dy = targetPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 1600) {
            const baseStats = entity.components.get('BaseStats');
            const speed = baseStats ? baseStats.speed * 50 : 60;
            const velocity = entity.components.get('Velocity');
            const pathFound = Pathfinder.followPath(transform, state, targetPos, speed, this.system.engine, 12, null, null, velocity);

            if (pathFound === -1) {
                const nextId = logistics && civ
                    ? logistics.findStorageForDeposit(civ.villageId, carriedType, inventory.getTotal(), transform, { excludeId: state.targetId })
                    : null;
                state.targetId = nextId;
                state.path = null;
                return nextId ? null : AnimalStates.IDLE;
            }
            return null;
        }

        transform.vx = 0;
        transform.vy = 0;

        const storage = targetEntity.components.get('Storage');
        if (!storage) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const deposited = [];
        for (const [resourceType, amount] of Object.entries({ ...inventory.items })) {
            if (amount <= 0) continue;
            const added = typeof storage.addItem === 'function'
                ? storage.addItem(resourceType, amount)
                : this._manualStorageAdd(storage, resourceType, amount);

            if (added > 0) {
                inventory.remove(resourceType, added);
                deposited.push(`+${added} ${resourceType.toUpperCase()}`);
            }
        }

        if (deposited.length > 0) {
            this.system.eventBus?.emit('SHOW_SPEECH_BUBBLE', {
                entityId,
                text: deposited.join(', '),
                type: 'deposit',
                duration: 1800
            });
            GlobalLogger.success(`Citizen ${entityId} deposited resources: ${deposited.join(', ')}`);
        }

        if (inventory.getTotal() > 0) {
            const nextType = this._firstInventoryType(inventory);
            const nextId = logistics && civ
                ? logistics.findStorageForDeposit(civ.villageId, nextType, inventory.getTotal(), transform, { excludeId: state.targetId })
                : null;
            state.targetId = nextId;
            state.path = null;
            return nextId ? null : AnimalStates.IDLE;
        }

        state.targetId = null;
        state.logisticsDestStorageId = null;
        state.unreachableTargets?.clear?.();
        return AnimalStates.IDLE;
    }

    _firstInventoryType(inventory) {
        return Object.keys(inventory.items || {}).find(type => (inventory.items[type] || 0) > 0) || 'wood';
    }

    _manualStorageAdd(storage, type, amount) {
        const used = Object.values(storage.items || {}).reduce((sum, value) => sum + value, 0);
        const add = Math.min(amount, Math.max(0, (storage.capacity || 0) - used));
        if (add > 0) {
            storage.items[type] = (storage.items[type] || 0) + add;
            storage._updateStatus?.();
        }
        return add;
    }
}
