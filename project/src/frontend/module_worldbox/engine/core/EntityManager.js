import ResourceNode from '../components/resource/ResourceNode.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';

export default class EntityManager {
    constructor() {
        this.entities = new Map();
        this.nextId = 0;
    }

    createEntity() {
        const id = this.nextId++;
        this.entities.set(id, { id, components: new Map() });
        return id;
    }

    removeEntity(id) {
        this.entities.delete(id);
    }

    addComponent(entityId, component) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.components.set(component.constructor.name, component);
        }
    }

    createResourceNode(x, y, type, amount) {
        const id = this.createEntity();
        this.addComponent(id, new Transform(x, y));
        this.addComponent(id, new ResourceNode(type, amount));
        
        // Visual based on resource type
        let color = '#ffffff';
        if (type === 'grass') color = '#aed581';
        if (type === 'tree') color = '#388e3c';
        if (type === 'water') color = '#4fc3f7';
        
        this.addComponent(id, new Visual(color));
        return id;
    }

    getEntitiesByComponent(componentName) {
        return Array.from(this.entities.values()).filter(e => e.components.has(componentName));
    }
}