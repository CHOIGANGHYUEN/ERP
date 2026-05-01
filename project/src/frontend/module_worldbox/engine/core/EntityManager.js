import ResourceNode from '../components/resource/ResourceNode.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';
import resourceConfig from '../config/resource_balance.json'; // resource_balance.json 임포트

export default class EntityManager {
    constructor() {
        this.entities = new Map();
        this.animalIds = new Set();
        this.resourceIds = new Set();
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

    removeEntity(id) {
        const entity = this.entities.get(id);
        if (entity) {
            const building = entity.components.get('Building');
            if (building) {
                console.warn(`🏢 Removing Building Entity! ID: ${id}, Type: ${building.type}`);
                console.trace();
            }
            
            this.animalIds.delete(id);
            this.resourceIds.delete(id);
            
            // 🚀 [메모리 비우기] 재사용 전 데이터 초기화
            for (const component of entity.components.values()) {
                for (const key in component) {
                    if (typeof component[key] === 'number') component[key] = 0;
                    else if (typeof component[key] === 'string') component[key] = '';
                    else component[key] = null;
                }
            }
            this.entities.delete(id); // 활성 맵에서는 제거
            this.entityPool.push(id); // 재활용 대기소로 이동
        }
    }

    addComponent(entityId, component, overrideName = null) {
        const entity = this.entities.get(entityId);
        if (entity) {
            const name = overrideName || component.constructor.name;
            entity.components.set(name, component);
            
            // 🚀 [Expert Tracking] 동물과 자원을 전용 세트에서 관리하여 루프 오버헤드 최소화
            if (name === 'Animal') this.animalIds.add(entityId);
            if (name === 'Resource') this.resourceIds.add(entityId);
        }
    }

    createResourceNode(x, y, type, amount) {
        const id = this.createEntity();
        this.addComponent(id, new Transform(x, y));
        this.addComponent(id, new ResourceNode(type, amount));

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
}