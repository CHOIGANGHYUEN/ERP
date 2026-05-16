import { JobTypes } from '../../../../config/JobTypes.js';
import ResourceRegistry from '../../../../data/ResourceRegistry.js';
import { GlobalLogger } from '../../../../utils/Logger.js';

export default class LogisticsMediator {
    constructor(entityManager, engine) {
        this.em = entityManager;
        this.engine = engine;
        this.virtualStorage = new Map();
        this._timer = 0;
    }

    update(dt, villages) {
        this._timer += dt;
        if (this._timer < 2.0) return;
        this._timer = 0;

        for (const village of villages.values()) {
            this.refreshVillage(village);
            this._rerouteCarriers(village);
        }
    }

    refreshVillage(village) {
        const entries = this._getStorageEntries(village);
        const totals = {};
        let capacity = 0;
        let used = 0;

        for (const entry of entries) {
            capacity += entry.capacity;
            used += entry.used;
            for (const [type, amount] of Object.entries(entry.storage.items || {})) {
                totals[type] = (totals[type] || 0) + amount;
            }
        }

        const snapshot = {
            villageId: village.id,
            storageCount: entries.length,
            capacity,
            used,
            free: Math.max(0, capacity - used),
            totals,
            entries
        };
        this.virtualStorage.set(village.id, snapshot);
        return snapshot;
    }

    getVirtualStorage(villageId) {
        return this.virtualStorage.get(villageId) || null;
    }

    findStorageForDeposit(villageId, resourceType, amount = 1, fromTransform = null, options = {}) {
        const village = this.engine.systemManager?.villageSystem?.getVillage(villageId);
        if (!village) return null;

        const entries = this.refreshVillage(village).entries;
        return this._pickBestStorage(entries, fromTransform, (entry) => {
            if (entry.id === options.excludeId) return false;
            if (entry.free <= 0) return false;
            if (options.preferredId && entry.id === options.preferredId) return true;
            return true;
        })?.id || null;
    }

    findStorageForWithdraw(villageId, resourceType, amount = 1, fromTransform = null, options = {}) {
        const village = this.engine.systemManager?.villageSystem?.getVillage(villageId);
        if (!village) return null;

        const entries = this.refreshVillage(village).entries;
        return this._pickBestStorage(entries, fromTransform, (entry) => {
            if (entry.id === options.excludeId) return false;
            return this._findStoredType(entry.storage, resourceType, amount) !== null;
        })?.id || null;
    }

    isStorageUsable(storageId, isDeposit = true, resourceType = null) {
        const entity = this.em.entities.get(storageId);
        const storage = entity?.components.get('Storage');
        const structure = entity?.components.get('Structure');
        if (!entity || !storage || (structure && !structure.isComplete)) return false;
        if (isDeposit) return this._getFree(storage) > 0;
        return this._findStoredType(storage, resourceType || 'wood', 1) !== null;
    }

    createDispatchOrder(village) {
        const snapshot = this.refreshVillage(village);
        if (snapshot.entries.length < 2) return null;

        const resourceType = this._pickImbalancedResource(village, snapshot);
        if (!resourceType) return null;

        const source = snapshot.entries
            .filter(entry => this._findStoredType(entry.storage, resourceType, 5))
            .sort((a, b) => (b.storage.items[this._findStoredType(b.storage, resourceType, 1)] || 0) -
                            (a.storage.items[this._findStoredType(a.storage, resourceType, 1)] || 0))[0];
        if (!source) return null;

        const dest = snapshot.entries
            .filter(entry => entry.id !== source.id && entry.free > 0)
            .sort((a, b) => (a.storage.items[resourceType] || 0) - (b.storage.items[resourceType] || 0))[0];
        if (!dest) return null;

        const worker = this._findDispatchWorker(village);
        if (!worker) return null;

        const amount = Math.min(5, source.storage.items[this._findStoredType(source.storage, resourceType, 1)] || 0);
        const state = worker.components.get('AIState');
        const jobCtrl = worker.components.get('JobController');
        if (!state || amount <= 0) return null;

        state.targetId = source.id;
        state.targetResourceType = resourceType;
        state.logisticsDestStorageId = dest.id;
        state.logisticsAmount = amount;
        state.mode = 'withdraw';
        state.isTargetRequested = false;
        state.targetRequestFailed = false;
        state.path = null;

        jobCtrl?.setData?.('logisticsOrder', {
            sourceId: source.id,
            destId: dest.id,
            resourceType,
            amount
        });

        GlobalLogger.info(`[Logistics] Chief dispatched ${worker.id}: ${resourceType} ${source.id} -> ${dest.id}.`);
        return {
            workerId: worker.id,
            sourceId: source.id,
            destId: dest.id,
            resourceType,
            amount
        };
    }

    _rerouteCarriers(village) {
        for (const memberId of village.members || []) {
            const entity = this.em.entities.get(memberId);
            if (!entity) continue;

            const inventory = entity.components.get('Inventory');
            const transform = entity.components.get('Transform');
            const state = entity.components.get('AIState');
            const jobCtrl = entity.components.get('JobController');
            if (!inventory || inventory.getTotal() <= 0 || !transform) continue;

            const carriedType = this._firstInventoryType(inventory);
            if (state?.mode === 'deposit' && state.targetId && !this.isStorageUsable(state.targetId, true, carriedType)) {
                const nextId = this.findStorageForDeposit(village.id, carriedType, inventory.getTotal(), transform, { excludeId: state.targetId });
                if (nextId) {
                    state.targetId = nextId;
                    state.path = null;
                    state.pathIndex = 0;
                }
            }

            const destId = jobCtrl?.getData?.('destStorageId');
            if (destId && !this.isStorageUsable(destId, true, carriedType)) {
                const nextId = this.findStorageForDeposit(village.id, carriedType, inventory.getTotal(), transform, { excludeId: destId });
                if (nextId) {
                    jobCtrl.setData('destStorageId', nextId);
                    jobCtrl.jobState = 'GOING_TO_DEST';
                }
            }
        }
    }

    _getStorageEntries(village) {
        const entries = [];
        const ids = Array.from(village.storageIds || []);

        for (const id of ids) {
            const entity = this.em.entities.get(id);
            const storage = entity?.components.get('Storage');
            const structure = entity?.components.get('Structure');
            const transform = entity?.components.get('Transform');
            if (!entity || !storage || !transform || (structure && !structure.isComplete)) {
                village.storageIds?.delete?.(id);
                continue;
            }

            const used = this._getUsed(storage);
            const free = Math.max(0, (storage.capacity || 0) - used);
            storage.isFull = free <= 0;
            entries.push({ id, entity, storage, transform, used, free, capacity: storage.capacity || 0 });
        }

        return entries;
    }

    _pickBestStorage(entries, fromTransform, predicate) {
        let best = null;
        let bestScore = Infinity;

        for (const entry of entries) {
            if (!predicate(entry)) continue;
            const distSq = fromTransform
                ? (entry.transform.x - fromTransform.x) ** 2 + (entry.transform.y - fromTransform.y) ** 2
                : 0;
            const score = distSq - entry.free * 4;
            if (score < bestScore) {
                bestScore = score;
                best = entry;
            }
        }

        return best;
    }

    _pickImbalancedResource(village, snapshot) {
        const needs = village.needs?.targets || {};
        const candidates = ['food', 'wood', 'stone'];
        let bestType = null;
        let bestSurplus = 0;

        for (const type of candidates) {
            const total = Object.entries(snapshot.totals)
                .filter(([storedType]) => ResourceRegistry.isMatch(storedType, type))
                .reduce((sum, [, amount]) => sum + amount, 0);
            const target = needs[type] || 50;
            const surplus = total - target * 0.75;
            if (surplus > bestSurplus && total >= 10) {
                bestSurplus = surplus;
                bestType = type;
            }
        }

        return bestType;
    }

    _findDispatchWorker(village) {
        const preferredJobs = new Set([JobTypes.MERCHANT, JobTypes.GATHERER, JobTypes.UNEMPLOYED]);
        for (const memberId of village.members || []) {
            if (memberId === village.chiefId) continue;
            const entity = this.em.entities.get(memberId);
            const civ = entity?.components.get('Civilization');
            const inventory = entity?.components.get('Inventory');
            const state = entity?.components.get('AIState');
            if (!entity || !state || !inventory || inventory.getTotal() > 0) continue;
            if (!preferredJobs.has(civ?.jobType || JobTypes.UNEMPLOYED)) continue;
            if (state.mode !== 'idle' && state.mode !== 'wander') continue;
            return entity;
        }
        return null;
    }

    _findStoredType(storage, resourceType, amount = 1) {
        for (const [type, count] of Object.entries(storage.items || {})) {
            if (count >= amount && ResourceRegistry.isMatch(type, resourceType)) {
                return type;
            }
        }
        return null;
    }

    _firstInventoryType(inventory) {
        return Object.keys(inventory.items || {}).find(type => (inventory.items[type] || 0) > 0) || 'wood';
    }

    _getUsed(storage) {
        return typeof storage.getTotalItems === 'function'
            ? storage.getTotalItems()
            : Object.values(storage.items || {}).reduce((sum, amount) => sum + amount, 0);
    }

    _getFree(storage) {
        return Math.max(0, (storage.capacity || 0) - this._getUsed(storage));
    }
}
