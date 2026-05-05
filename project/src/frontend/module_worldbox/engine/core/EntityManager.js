import ResourceNode from '../components/resource/ResourceNode.js';
import Transform from '../components/motion/Transform.js';
import Visual, { VISUAL_TYPES } from '../components/render/Visual.js';
import BufferManager from './BufferManager.js';
import resourceConfig from '../config/resource_balance.json';

export default class EntityManager {
    constructor(bufferManager = null) {
        // 🚀 [DOD] 버퍼 매니저 주입 또는 생성
        this.bufferManager = bufferManager || new BufferManager(20000);
        
        this.entities = new Map();
        this.animalIds = new Set();
        this.humanIds = new Set();
        this.resourceIds = new Set();
        this.buildingIds = new Set();
        this.nextId = 0;
        this.entityPool = [];
    }

    createEntity() {
        let id;
        if (this.entityPool.length > 0) {
            id = this.entityPool.pop();
        } else {
            id = this.nextId++;
        }

        // 🚀 [DOD] 엔티티 생성 시 버퍼 데이터 초기화
        this.entities.set(id, { id, components: new Map() });
        this.bufferManager.initEntity(id); 
        
        return id;
    }

    removeEntity(id, spatialHash = null) {
        const entity = this.entities.get(id);
        if (entity) {
            // 🚀 [Synchronization] 공간 해시에서 즉시 제거 (유령 타겟 방지)
            const sh = spatialHash || this.spatialHash;
            if (sh) {
                const transform = entity.components.get('Transform');
                if (transform) {
                    sh.remove(id, transform.x, transform.y);
                }
            }

            const building = entity.components.get('Building');
            if (building) {
                console.warn(`🏢 Removing Building Entity! ID: ${id}, Type: ${building.type}`);
            }
            
            this.animalIds.delete(id);
            this.humanIds.delete(id); // 👤 인간 인덱스 제거
            this.resourceIds.delete(id);
            this.buildingIds.delete(id);
            
            // 🚀 [Memory Optimization] 컴포넌트 맵을 명시적으로 비워 참조 해제
            entity.components.clear();
            
            this.entities.delete(id); // 활성 맵에서는 제거
            this.bufferManager.releaseEntity(id); // 🚀 [DOD] 버퍼 상태 비활성화
            this.entityPool.push(id); // 재활용 대기소로 이동
        }
    }

    /**
     * 모든 엔티티 정보를 초기화합니다. (시뮬레이션 재시작용)
     */
    clearAll() {
        this.entities.clear();
        this.animalIds.clear();
        this.humanIds.clear();
        this.resourceIds.clear();
        this.buildingIds.clear();
        this.entityPool = [];
        this.nextId = 0;
    }

    addComponent(entityId, component, overrideName = null) {
        const entity = this.entities.get(entityId);
        if (entity) {
            let name = overrideName || component.constructor.name;
            
            // 🚀 [DOD Integration] 버퍼 기반 컴포넌트인 경우 연결 정보 주입
            if (component.hasOwnProperty('entityId') && component.hasOwnProperty('bufferManager')) {
                component.entityId = entityId;
                component.bufferManager = this.bufferManager;
                
                // 초기값 동기화 (생성자에서 세팅된 _x, _hp 등을 버퍼로 전송)
                if (name === 'Transform') {
                    this.bufferManager.x[entityId] = component.x;
                    this.bufferManager.y[entityId] = component.y;
                    this.bufferManager.vx[entityId] = component.vx || 0;
                    this.bufferManager.vy[entityId] = component.vy || 0;
                } else if (name === 'BaseStats') {
                    const bm = this.bufferManager;
                    bm.hp[entityId] = component.health;
                    bm.maxHp[entityId] = component.maxHealth;
                    bm.hunger[entityId] = component.hunger;
                    bm.fatigue[entityId] = component.fatigue;
                    bm.strength[entityId] = component.strength;
                    bm.defense[entityId] = component.defense;
                    bm.speed[entityId] = component.speed;
                } else if (name === 'Visual') {
                    const bm = this.bufferManager;
                    bm.vType[entityId] = VISUAL_TYPES.indexOf(component.type || 'fallback');
                    bm.vSize[entityId] = component.size || 10;
                    bm.vColor[entityId] = component.packColor ? component.packColor(component.color) : 0xFFFFFF;
                }
            }

            // 🚀 [FIX] 일반 객체({})로 전달된 경우 클래스 이름이 'Object'가 되는 문제 방지
            if (name === 'Object') {
                if (component.type === 'wood' || component.isTree) name = 'Resource';
                else if (component.edible || component.type === 'food') name = 'Resource';
                else if (component.isBlueprint || component.progress !== undefined) name = 'Structure';
                else if (component.villageId !== undefined || component.maxHealth !== undefined) name = 'Building';
            }

            entity.components.set(name, component);
            
            if (name === 'Animal') {
                this.animalIds.add(entityId);
                if (component.type === 'human') this.humanIds.add(entityId);
            }
            if (name === 'Resource' || name === 'DroppedItem') this.resourceIds.add(entityId);
            if (name === 'Building' || name === 'Structure') this.buildingIds.add(entityId);
        }
    }

    createResourceNode(x, y, type, amount) {
        const id = this.createEntity();
        this.addComponent(id, new Transform(x, y));
        this.addComponent(id, new ResourceNode(type, amount), 'Resource');

        // Visual based on resource type
        // resource_balance.json에서 해당 자원의 색상 정보를 가져옵니다.
        const resourceInfo = resourceConfig[type];
        let color = resourceInfo && resourceInfo.color ? resourceInfo.color : null;

        if (!color) {
            // 속성 기반 자동 색상 부여 (JSON에 color 속성이 없을 때의 Fallback)
            if (type.includes('gold')) color = '#fbc02d';
            else if (type.includes('silver')) color = '#e0e0e0';
            else if (type.includes('copper')) color = '#d84315';
            else if (type.includes('iron')) color = '#6d4c41';
            else if (type.includes('coal') || type.includes('obsidian')) color = '#212121';
            else if (type.includes('gems')) color = '#e040fb';
            else if (type.includes('stone') || type.includes('gravel') || type.includes('flint')) color = '#9e9e9e';
            else if (type.includes('sand')) color = '#f4d03f';
            else if (type.includes('clay') || type.includes('mud')) color = '#8d6e63';
            else if (type.includes('salt')) color = '#ffffff';
            else if (resourceInfo && resourceInfo.type === 'mineral') color = '#9e9e9e';
            else if (resourceInfo && (resourceInfo.type === 'wood' || type.includes('tree'))) color = '#5d4037';
            else if (resourceInfo && resourceInfo.type === 'food') color = '#4caf50';
            else color = '#ffffff';
        }

        this.addComponent(id, new Visual(color));
        return id;
    }

    getEntitiesByComponent(componentName) {
        return Array.from(this.entities.values()).filter(e => e.components.has(componentName));
    }

    findNearestEntityWithComponent(x, y, radius, condition, spatialHash = null) {
        let nearestId = null;
        let minDistSq = radius * radius;

        const nearbyIds = spatialHash
            ? spatialHash.query(x, y, radius)
            : Array.from(this.entities.keys());

        for (const id of nearbyIds) {
            const entity = this.entities.get(id);
            if (!entity) continue;
            
            if (condition && !condition(entity)) continue;

            const transform = entity.components.get('Transform');
            if (!transform) continue;

            const distSq = (transform.x - x) ** 2 + (transform.y - y) ** 2;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearestId = id;
            }
        }

        return nearestId;
    }
}