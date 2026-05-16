import { GlobalLogger } from '../../../../utils/Logger.js';
import ResourceRegistry from '../../../../data/ResourceRegistry.js';

/**
 * ResourceTransaction
 * Keeps warehouse -> inventory -> blueprint transfers lossless. If a worker dies
 * or is interrupted, DeathProcessor calls dropAll so carried resources re-enter
 * the world instead of disappearing.
 */
export default class ResourceTransaction {
    constructor(entityManager, engine) {
        this.em = entityManager;
        this.engine = engine;
    }

    withdraw(entity, storageId, resourceType, amount) {
        const storageEntity = this.em.entities.get(storageId);
        const inventory = entity.components.get('Inventory');
        const storage = storageEntity?.components.get('Storage');

        if (!storageEntity || !inventory || !storage) return false;

        const storedType = this._findStoredType(storage, resourceType);
        if (!storedType) return false;

        const requested = Math.max(0, amount || 0);
        const actualAmount = Math.min(
            requested,
            storage.items[storedType] || 0,
            inventory.capacity - inventory.getTotal()
        );
        if (actualAmount <= 0) return false;

        const removed = typeof storage.withdraw === 'function'
            ? storage.withdraw(storedType, actualAmount)
            : this._removeFromStorage(storage, storedType, actualAmount);

        const added = inventory.add(resourceType, removed);
        if (added < removed) {
            storage.addItem?.(storedType, removed - added);
        }

        GlobalLogger.info(`[Transaction] Entity ${entity.id} withdrew ${added} ${resourceType} from Storage ${storageId}`);
        return added > 0;
    }

    deposit(entity, buildingId, resourceType, amount) {
        const building = this.em.entities.get(buildingId);
        const inventory = entity.components.get('Inventory');
        const structure = building?.components.get('Structure');

        if (!building || !inventory || !structure) return false;

        const inventoryType = this._findStoredType(inventory, resourceType) || resourceType;
        const actualAmount = Math.min(amount || 0, inventory.items[inventoryType] || 0);
        if (actualAmount <= 0) return false;

        inventory.remove(inventoryType, actualAmount);
        structure.progress = Math.min(
            structure.maxProgress,
            (structure.progress || 0) + actualAmount * 10
        );

        if (structure.progress >= structure.maxProgress) {
            structure.isComplete = true;
        }

        GlobalLogger.info(`[Transaction] Entity ${entity.id} deposited ${actualAmount} ${resourceType} into Building ${buildingId}. Progress: ${structure.progress}/${structure.maxProgress}`);
        return true;
    }

    dropAll(entityId) {
        const entity = this.em.entities.get(entityId);
        const inventory = entity?.components.get('Inventory');
        const transform = entity?.components.get('Transform');

        if (!inventory || !transform) return;

        const itemFactory = this.engine.factoryProvider?.getFactory('item');
        if (!itemFactory) return;

        for (const [type, amount] of Object.entries(inventory.items)) {
            if (amount <= 0) continue;

            const civ = entity.components.get('Civilization');
            itemFactory.spawnDrop(transform.x, transform.y, type, amount, civ ? civ.villageId : -1);
            inventory.remove(type, amount);
        }
    }

    _findStoredType(container, resourceType) {
        for (const [type, count] of Object.entries(container.items || {})) {
            if (count > 0 && ResourceRegistry.isMatch(type, resourceType)) {
                return type;
            }
        }
        return null;
    }

    _removeFromStorage(storage, resourceType, amount) {
        const current = storage.items[resourceType] || 0;
        const removed = Math.min(current, amount);
        if (removed > 0) {
            storage.items[resourceType] = current - removed;
            if (storage.items[resourceType] <= 0) delete storage.items[resourceType];
            storage._updateStatus?.();
        }
        return removed;
    }
}
