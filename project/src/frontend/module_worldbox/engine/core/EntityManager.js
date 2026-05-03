import ResourceNode from '../components/resource/ResourceNode.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';
import resourceConfig from '../config/resource_balance.json'; // resource_balance.json 임포트

export default class EntityManager {
    constructor() {
        this.entities = new Map();
        this.animalIds = new Set();
        this.humanIds = new Set(); // 👤 인간 전용 인덱스 추가
        this.resourceIds = new Set();
        this.buildingIds = new Set();
        this.nextId = 0;
        this.entityPool = []; // 🗑️ 쓰레기통(재활용 대기소): 삭제된 엔티티 번호를 모아둠
    }

    createEntity() {
        // 🚀 [재활용] 풀에 남은 게 있다면 새 번호를 발급하지 않고 꺼내서 재사용
        if (this.entityPool.length > 0) {
            const id = this.entityPool.pop();
            this.entities.set(id, { id, components: new Map() });
            return id;
        }

        const id = this.nextId++;
        this.entities.set(id, { id, components: new Map() });
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
            
            // 🚀 [FIX] 일반 객체({})로 전달된 경우 클래스 이름이 'Object'가 되는 문제 방지
            if (name === 'Object') {
                if (component.type === 'wood' || component.isTree) name = 'Resource';
                else if (component.edible || component.type === 'food') name = 'Resource';
                else if (component.isBlueprint || component.progress !== undefined) name = 'Structure';
            }

            entity.components.set(name, component);
            
            if (name === 'Animal') {
                this.animalIds.add(entityId);
                if (component.type === 'human') this.humanIds.add(entityId);
            }
            if (name === 'Resource' || name === 'DroppedItem') this.resourceIds.add(entityId);
            if (name === 'Building') this.buildingIds.add(entityId);
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