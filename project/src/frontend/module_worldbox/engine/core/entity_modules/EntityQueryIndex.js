/**
 * 🚀 [Expert Optimization] O(1) 접근과 Dense Array 순회를 동시에 지원하는 초고속 Set 대체재
 */
export class DenseEntitySet {
    constructor(maxEntities) {
        this.items = [];
        this.indices = new Int32Array(maxEntities).fill(-1);
    }
    add(id) {
        if (id >= this.indices.length) this._expand(id);
        if (this.indices[id] === -1) {
            this.indices[id] = this.items.length;
            this.items.push(id);
        }
    }
    delete(id) {
        if (id >= this.indices.length || this.indices[id] === -1) return false;
        const index = this.indices[id];
        const lastItem = this.items[this.items.length - 1];
        this.items[index] = lastItem;
        this.indices[lastItem] = index;
        this.items.pop();
        this.indices[id] = -1;
        return true;
    }
    has(id) {
        if (id >= this.indices.length) return false;
        return this.indices[id] !== -1;
    }
    clear() {
        this.items = [];
        this.indices.fill(-1);
    }
    get size() { return this.items.length; }
    [Symbol.iterator]() { return this.items[Symbol.iterator](); }
    _expand(id) {
        const newMax = Math.max(id + 1, Math.floor(this.indices.length * 1.5));
        const newIndices = new Int32Array(newMax).fill(-1);
        newIndices.set(this.indices);
        this.indices = newIndices;
    }
}

/**
 * 🏷️ EntityQueryIndex
 * 동물, 인간, 건물 등 유형별 고속 검색 인덱스를 관리합니다.
 * EntityManager.js에서 SRP에 따라 분리되었습니다.
 */
export default class EntityQueryIndex {
    constructor() {
        this.animalIds = new DenseEntitySet(10000);
        this.humanIds = new DenseEntitySet(10000); 
        this.resourceIds = new DenseEntitySet(10000);
        this.buildingIds = new DenseEntitySet(10000);
        this.activeFarmIds = new DenseEntitySet(5000);
        this.villageCenterIds = new DenseEntitySet(500);
        this.emissiveIds = new DenseEntitySet(1000);
        this.droppedItemIds = new DenseEntitySet(10000); // 📦 드롭된 아이템용 인덱스 추가
    }

    addToIndex(id, componentName, entity) {
        if (componentName === 'Animal') {
            this.animalIds.add(id);
        } else if (componentName === 'Civilization' || componentName === 'JobController') {
            const jobCtrl = entity.components.get('JobController');
            if (jobCtrl || componentName === 'JobController') {
                this.humanIds.add(id);
                this.animalIds.add(id);
            }
        } else if (componentName === 'Resource') {
            this.resourceIds.add(id);
        } else if (componentName === 'DroppedItem') {
            this.droppedItemIds.add(id);
        } else if (componentName === 'Building' || componentName === 'Structure') {
            this.buildingIds.add(id);
            if (componentName === 'Farm') this.activeFarmIds.add(id);
        } else if (componentName === 'Farm') {
            this.activeFarmIds.add(id);
            this.buildingIds.add(id);
        } else if (componentName === 'VillageCenter') {
            this.villageCenterIds.add(id);
            this.buildingIds.add(id);
        }
    }

    removeFromIndex(id) {
        this.animalIds.delete(id);
        this.humanIds.delete(id);
        this.resourceIds.delete(id);
        this.buildingIds.delete(id);
        this.activeFarmIds.delete(id);
        this.villageCenterIds.delete(id);
        this.emissiveIds.delete(id);
        this.droppedItemIds.delete(id);
    }

    clear() {
        this.animalIds.clear();
        this.humanIds.clear();
        this.resourceIds.clear();
        this.buildingIds.clear();
        this.activeFarmIds.clear();
        this.villageCenterIds.clear();
        this.emissiveIds.clear();
        this.droppedItemIds.clear();
    }
}
