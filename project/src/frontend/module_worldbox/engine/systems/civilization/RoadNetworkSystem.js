import System from '../../core/System.js';
import Pathfinder from '../../utils/Pathfinder.js';
import { JobTypes } from '../../config/JobTypes.js';
import { GlobalLogger } from '../../utils/Logger.js';

const ROAD_TYPES = new Set(['road', 'dirt_road', 'stone_road']);
const ROAD_COSTS = {
    road: 0.55,
    dirt_road: 0.65,
    stone_road: 0.45
};

export default class RoadNetworkSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.roadTiles = new Map();
        this._trackTimer = 0;
        this._scanTimer = 0;

        this.eventBus.on('BUILDING_COMPLETE', (payload) => this._onBuildingComplete(payload));
    }

    update(dt) {
        this._trackTimer += dt;
        if (this._trackTimer >= 1.0) {
            this._trackTimer = 0;
            this._trackChiefTrails();
        }

        this._scanTimer += dt;
        if (this._scanTimer >= 8.0) {
            this._scanTimer = 0;
            this._registerExistingRoads();
        }
    }

    getCostAt(x, y) {
        const tx = Math.floor(x / 16);
        const ty = Math.floor(y / 16);
        return this.roadTiles.get(this._key(tx, ty))?.cost || 1;
    }

    hasRoadAtTile(tx, ty) {
        return this.roadTiles.has(this._key(tx, ty));
    }

    _onBuildingComplete({ id, type, villageId }) {
        if (!ROAD_TYPES.has(type)) return;
        const entity = this.entityManager.entities.get(id);
        const transform = entity?.components.get('Transform');
        if (!transform) return;

        this.registerRoad(transform.x, transform.y, type, villageId, id);
    }

    registerRoad(x, y, type = 'dirt_road', villageId = -1, entityId = null) {
        const tx = Math.floor(x / 16);
        const ty = Math.floor(y / 16);
        const key = this._key(tx, ty);
        const cost = ROAD_COSTS[type] || ROAD_COSTS.road;

        this.roadTiles.set(key, { tx, ty, x: tx * 16 + 8, y: ty * 16 + 8, type, villageId, entityId, cost });
        Pathfinder.setTileCost(tx, ty, cost);
        Pathfinder.markClusterDirty(tx * 16 + 8, ty * 16 + 8);
        this.engine.chunkManager?.markDirty(tx * 16 + 8, ty * 16 + 8);

        this.eventBus.emit('ROAD_BUILT', { tx, ty, x: tx * 16 + 8, y: ty * 16 + 8, type, villageId, entityId, cost });
        GlobalLogger.info(`[Road] ${type} linked tile (${tx}, ${ty}) to Pathfinder cost ${cost}.`);
    }

    _trackChiefTrails() {
        const villageSystem = this.engine.systemManager?.villageSystem;
        if (!villageSystem) return;

        for (const village of villageSystem.villages.values()) {
            const chief = this.entityManager.entities.get(village.chiefId);
            const transform = chief?.components.get('Transform');
            const civ = chief?.components.get('Civilization');
            if (!transform || civ?.jobType !== JobTypes.CHIEF) continue;

            const tx = Math.floor(transform.x / 16);
            const ty = Math.floor(transform.y / 16);
            const key = this._key(tx, ty);
            if (!village.territory?.has(key) || this.hasRoadAtTile(tx, ty)) continue;

            if (!village.trailHeat) village.trailHeat = new Map();
            const heat = (village.trailHeat.get(key) || 0) + 1;
            village.trailHeat.set(key, heat);

            const threshold = village.members.size >= 12 ? 4 : 6;
            if (heat >= threshold) {
                this._placeRoadBlueprint(village, tx, ty);
                village.trailHeat.set(key, 0);
            }
        }
    }

    _placeRoadBlueprint(village, tx, ty) {
        if ((village._roadPlanCooldown || 0) > Date.now()) return;
        if (this._countPendingRoads(village) >= 3) return;
        if (this._hasRoadEntityNearby(tx, ty)) return;

        const x = tx * 16 + 8;
        const y = ty * 16 + 8;
        const terrain = this.engine.terrainGen;
        if (terrain && !terrain.isNavigable(x, y)) return;

        const type = village.members.size >= 20 ? 'stone_road' : 'dirt_road';
        const id = this.engine.factoryProvider.spawn('building', type, x, y, {
            isBlueprint: true,
            villageId: village.id,
            size: 14
        });

        if (id) {
            village._roadPlanCooldown = Date.now() + 5000;
            this.eventBus.emit('ROAD_BLUEPRINT_PLACED', { id, villageId: village.id, type, tx, ty });
        }
    }

    _countPendingRoads(village) {
        let count = 0;
        for (const id of village.buildings || []) {
            const entity = this.entityManager.entities.get(id);
            const structure = entity?.components.get('Structure');
            if (structure && ROAD_TYPES.has(structure.type) && !structure.isComplete) {
                count++;
            }
        }
        return count;
    }

    _hasRoadEntityNearby(tx, ty) {
        const x = tx * 16 + 8;
        const y = ty * 16 + 8;
        const nearby = this.engine.spatialHash?.query(x, y, 12) || [];
        for (const id of nearby) {
            const entity = this.entityManager.entities.get(id);
            const structure = entity?.components.get('Structure');
            if (structure && ROAD_TYPES.has(structure.type)) return true;
            if (entity?.components.has('Road')) return true;
        }
        return false;
    }

    _registerExistingRoads() {
        for (const entity of this.entityManager.entities.values()) {
            const structure = entity.components.get('Structure');
            if (!structure?.isComplete || !ROAD_TYPES.has(structure.type)) continue;

            const transform = entity.components.get('Transform');
            const civ = entity.components.get('Civilization');
            if (transform) {
                const key = this._key(Math.floor(transform.x / 16), Math.floor(transform.y / 16));
                if (!this.roadTiles.has(key)) {
                    this.registerRoad(transform.x, transform.y, structure.type, civ?.villageId ?? -1, entity.id);
                }
            }
        }
    }

    _key(tx, ty) {
        return (ty << 16) | tx;
    }
}
