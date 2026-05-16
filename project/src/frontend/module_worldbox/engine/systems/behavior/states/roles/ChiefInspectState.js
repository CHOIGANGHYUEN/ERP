import State from '../State.js';
import Pathfinder from '../../../../utils/Pathfinder.js';
import BlueprintRegistry from '../../../../data/BlueprintRegistry.js';
import ResourceRegistry from '../../../../data/ResourceRegistry.js';

export default class ChiefInspectState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const velocity = entity.components.get('Velocity');
        const inventory = entity.components.get('Inventory');
        const em = this.system.entityManager;

        if (!state || !state.targetId) return 'idle';

        const target = em.entities.get(state.targetId);
        const targetTransform = target?.components.get('Transform');
        const structure = target?.components.get('Structure');

        if (!target || !targetTransform || !structure || structure.isComplete) {
            state.targetId = null;
            return 'idle';
        }

        const reached = Pathfinder.followPath(
            transform,
            state,
            targetTransform,
            55,
            this.system.engine,
            30,
            5000,
            state.targetId,
            velocity
        );

        if (reached === true) {
            transform.vx = 0;
            transform.vy = 0;
            state.inspectTimer = (state.inspectTimer || 0) + dt;

            if (state.inspectTimer >= 0.7) {
                state.inspectTimer = 0;
                this._tryContributeResource(entity, target, structure, inventory);
            }

            if (structure.progress >= structure.maxProgress) {
                structure.isComplete = true;
                const constructionSystem = this.system.engine.systemManager?.construction;
                constructionSystem?.finalizeBuilding(target, state.targetId, structure);
                state.targetId = null;
                return 'idle';
            }
        } else if (reached === -1) {
            state.targetId = null;
            return 'idle';
        }

        return null;
    }

    _tryContributeResource(entity, target, structure, inventory) {
        const requiredType = BlueprintRegistry.getRequiredResource(structure.type, structure.progress || 0);
        const transaction = this.system.engine.systemManager?.villageSystem?.resourceTransaction;

        if (inventory && ResourceRegistry.hasMatchInItems(inventory.items, requiredType, 1)) {
            transaction?.deposit(entity, target.id, requiredType, 1);
            return true;
        }

        const picked = this._pickNearbySurplus(entity, requiredType, inventory);
        if (picked && transaction?.deposit(entity, target.id, requiredType, 1)) {
            this.system.eventBus?.emit('SHOW_SPEECH_BUBBLE', {
                entityId: entity.id,
                text: 'Build',
                duration: 1200
            });
            return true;
        }

        return false;
    }

    _pickNearbySurplus(entity, requiredType, inventory) {
        if (!inventory) return false;

        const transform = entity.components.get('Transform');
        const civ = entity.components.get('Civilization');
        const spatialHash = this.system.engine.spatialHash;
        if (!transform || !spatialHash) return false;

        let bestId = null;
        let bestDistSq = 96 * 96;
        spatialHash.eachInRange(transform.x, transform.y, 96, (id) => {
            const itemEntity = this.system.entityManager.entities.get(id);
            const drop = itemEntity?.components.get('DroppedItem');
            if (!drop) return;
            if (drop.villageId !== -1 && civ && drop.villageId !== civ.villageId) return;
            if (!ResourceRegistry.isMatch(drop.itemType || drop.category, requiredType) &&
                !ResourceRegistry.isMatch(drop.category || drop.itemType, requiredType)) return;

            const pos = itemEntity.components.get('Transform');
            if (!pos) return;
            const dx = pos.x - transform.x;
            const dy = pos.y - transform.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestId = id;
            }
        });

        if (!bestId) return false;

        const itemEntity = this.system.entityManager.entities.get(bestId);
        const drop = itemEntity?.components.get('DroppedItem');
        if (!drop || drop.amount <= 0) return false;

        const added = inventory.add(requiredType, 1);
        if (added <= 0) return false;

        drop.amount -= 1;
        if (drop.amount <= 0) {
            this.system.entityManager.removeEntity(bestId);
        }

        return true;
    }
}
