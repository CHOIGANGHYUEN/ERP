import ResourceNode from '../components/resource/ResourceNode.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';
import { factoryProvider } from '../factories/core/FactoryProvider.js';
import resourceConfig from '../config/resource_balance.json';
import EntityMemoryPool from './entity_modules/EntityMemoryPool.js';
import ComponentBufferManager from './entity_modules/ComponentBufferManager.js';
import EntityQueryIndex, { DenseEntitySet } from './entity_modules/EntityQueryIndex.js';

/**
 * 🚀 EntityManager (Facade/Coordinator)
 * ECS 아키텍처의 핵심 관리자로, 메모리 풀링, 버퍼 제어, 인덱싱을 조율합니다.
 * 리팩토링을 통해 내부 로직을 전문 서브 모듈들로 분리하였습니다.
 */
export default class EntityManager {
    constructor() {
        this.entities = new Map();
        
        // 🚀 서브 시스템 초기화
        this.buffers = new ComponentBufferManager(this);
        this.pool = new EntityMemoryPool(this);
        this.index = new EntityQueryIndex();
    }

    // --- Legacy Buffer Getters (Systems compatibility) ---
    get transformBuffer() { return this.buffers.transform; }
    get velocityBuffer() { return this.buffers.velocity; }
    get statsBuffer() { return this.buffers.stats; }
    get statsFloatBuffer() { return this.buffers.statsFloat; }
    get stateBuffer() { return this.buffers.state; }
    get jobBuffer() { return this.buffers.job; }
    get renderBuffer() { return this.buffers.render; }
    get aliveBuffer() { return this.buffers.alive; }
    get tagBuffer() { return this.buffers.tag; }
    get cellKeyBuffer() { return this.buffers.cellKey; }
    get maxEntities() { return this.buffers.maxEntities; }

    // --- Legacy Index Getters ---
    get animalIds() { return this.index.animalIds; }
    get humanIds() { return this.index.humanIds; }
    get resourceIds() { return this.index.resourceIds; }
    get buildingIds() { return this.index.buildingIds; }
    get activeFarmIds() { return this.index.activeFarmIds; }
    get villageCenterIds() { return this.index.villageCenterIds; }
    get emissiveIds() { return this.index.emissiveIds; }
    
    // --- Legacy Pool Getters ---
    get nextId() { return this.pool.nextId; }
    get freeIds() { return this.pool.freeIds; }
    get denseIds() { return this.pool.denseIds; }

    createEntity() {
        const id = this.pool.acquireId();
        const entity = {
            id,
            components: new Map(),
            denseIndex: this.pool.denseIds.length - 1
        };
        this.entities.set(id, entity);
        return id;
    }

    removeEntity(id) {
        if (!this.entities.has(id)) return;
        const entity = this.entities.get(id);

        // 1. 인덱스 제거
        this.index.removeFromIndex(id);

        // 2. 컴포넌트 해제
        for (const [name, component] of entity.components) {
            factoryProvider.releaseComponent(name, component);
        }
        entity.components.clear();

        // 3. 공간 해시 제거
        this._removeFromSpatialHash(id);

        // 4. ID 풀 반납 및 Dense Array 정리
        this.pool.releaseId(id, entity);
        this.entities.delete(id);

        if (this.eventBus) {
            this.eventBus.emit('ENTITY_REMOVED', { id, entity });
        }
    }

    _removeFromSpatialHash(id) {
        if (this.spatialHash && this.cellKeyBuffer) {
            const cellKey = this.cellKeyBuffer[id];
            if (cellKey !== undefined && cellKey !== -1) {
                this.spatialHash.removeFromCell(id, cellKey, 0);
                this.spatialHash.removeFromCell(id, cellKey, 1);
                this.spatialHash.removeFromCell(id, cellKey, 2);
            }
            this.cellKeyBuffer[id] = -1;
        }
    }

    addComponent(entityId, component, overrideName = null) {
        const entity = this.entities.get(entityId);
        if (!entity) return;

        let name = overrideName || component.constructor.name;
        if (name === 'Object') name = this._deduceComponentName(component);

        entity.components.set(name, component);
        
        // 1. 버퍼 연결
        this.buffers.linkComponent(entityId, name, component, entity);

        // 2. 인덱스 업데이트
        this.index.addToIndex(entityId, name, entity);

        // 3. 특수 처리 (공간 해시 등)
        this._handleSpecialComponentAdd(entityId, name, component);
    }

    _deduceComponentName(component) {
        if (component.type === 'wood' || component.isTree || component.constructor.name === 'ResourceNode') return 'Resource';
        if (component.edible || component.type === 'food') return 'Resource';
        if (component.itemType || component.constructor.name === 'DroppedItem') return 'DroppedItem';
        if (component.isBlueprint || component.progress !== undefined) return 'Structure';
        if (component.villageId !== undefined || component.maxHealth !== undefined) return 'Building';
        return 'Unknown';
    }

    _handleSpecialComponentAdd(entityId, name, component) {
        // 🏗️ [Explicit Layer Mapping] 0: Dynamic, 1: Static/Nature, 2: Obstacle/Building
        let layer = -1;
        if (name === 'Resource' || name === 'DroppedItem') layer = 1;
        else if (name === 'Building' || name === 'Structure' || name === 'VillageCenter') layer = 2;
        else if (name === 'Animal') layer = 0;

        if (name === 'Transform') {
            // 🗺️ [Expert Fix] Transform이 추가될 때, 이미 인덱싱된 경우 해당 레이어에 등록
            const currentLayer = this._determineEntityLayer(entityId);
            if (this.spatialHash && currentLayer !== -1) {
                this._updateSpatialHash(entityId, component.x, component.y, currentLayer);
            }
        } else if (layer !== -1) {
            // 특정 컴포넌트(Resource, Building 등)가 추가될 때 공간 해시 갱신
            const entity = this.entities.get(entityId);
            const transform = entity?.components.get('Transform');
            if (transform && this.spatialHash) {
                this._updateSpatialHash(entityId, transform.x, transform.y, layer);
            }
        }
    }

    /** 🔍 [Expert Utility] 엔티티의 현재 인덱스 상태를 기반으로 공간 해시 레이어 결정 */
    _determineEntityLayer(entityId) {
        if (this.index.resourceIds.has(entityId) || this.index.droppedItemIds.has(entityId)) return 1;
        if (this.index.buildingIds.has(entityId)) return 2;
        if (this.index.animalIds.has(entityId)) return 0;
        return -1;
    }

    clearAll() {
        this.entities.clear();
        this.index.clear();
        this.pool.clear();
        this.buffers.alive.fill(0);
    }

    createResourceNode(x, y, type, amount) {
        const id = this.createEntity();
        this.addComponent(id, new Transform(x, y));
        this.addComponent(id, new ResourceNode(type, amount), 'Resource');

        const resourceInfo = resourceConfig[type];
        let color = resourceInfo?.color || this._getColorByResourceType(type, resourceInfo);
        this.addComponent(id, new Visual(color));
        return id;
    }

    _getColorByResourceType(type, resourceInfo) {
        if (type.includes('gold')) return '#fbc02d';
        if (type.includes('silver')) return '#e0e0e0';
        if (type.includes('copper')) return '#d84315';
        if (type.includes('iron')) return '#6d4c41';
        if (type.includes('coal') || type.includes('obsidian')) return '#212121';
        if (type.includes('gems')) return '#e040fb';
        if (type.includes('stone') || type.includes('gravel') || type.includes('flint')) return '#9e9e9e';
        if (type.includes('sand')) return '#f4d03f';
        if (type.includes('clay') || type.includes('mud')) return '#8d6e63';
        if (type.includes('salt')) return '#ffffff';
        if (resourceInfo?.type === 'mineral') return '#9e9e9e';
        if (resourceInfo?.type === 'wood' || type.includes('tree')) return '#5d4037';
        if (resourceInfo?.type === 'food') return '#4caf50';
        return '#ffffff';
    }

    getEntitiesByComponent(componentName) {
        return Array.from(this.entities.values()).filter(e => e.components.has(componentName));
    }

    findNearestEntityWithComponent(x, y, radius, condition, spatialHash = null, layer = -1) {
        let nearestId = null;
        let minDistSq = radius * radius;
        const sh = spatialHash || this.spatialHash;

        if (sh) {
            sh.eachInSpiral(x, y, radius, (id) => {
                const entity = this.entities.get(id);
                if (!entity || (condition && !condition(entity))) return false;
                const transform = entity.components.get('Transform');
                if (!transform) return false;
                const dx = transform.x - x;
                const dy = transform.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                    if (minDistSq < 1600) return true;
                }
                return false;
            }, layer);
        } else {
            for (const [id, entity] of this.entities) {
                if (condition && !condition(entity)) continue;
                const transform = entity.components.get('Transform');
                if (!transform) continue;
                const dx = transform.x - x;
                const dy = transform.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }
        }
        return nearestId;
    }

    _updateSpatialHash(entityId, x, y, layer) {
        if (!this.spatialHash) return;
        const cellSize = this.spatialHash.cellSize || 100;
        const key = ((Math.floor(y / cellSize) + 1000) << 16) | (Math.floor(x / cellSize) + 1000);
        const oldKey = this.cellKeyBuffer[entityId];
        if (oldKey === key) return;
        if (oldKey !== -1) this.spatialHash.removeFromCell(entityId, oldKey, layer);
        this.spatialHash.insertWithKey(entityId, key, layer);
        this.cellKeyBuffer[entityId] = key;
    }
}
export { DenseEntitySet };