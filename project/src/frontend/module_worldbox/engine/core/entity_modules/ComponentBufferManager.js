/**
 * 💾 ComponentBufferManager
 * 물리적인 TypedArray 버퍼 선언 및 메모리 레이아웃, 컴포넌트 데이터 매핑을 담당합니다.
 * EntityManager.js에서 SRP에 따라 분리되었습니다.
 */
export default class ComponentBufferManager {
    constructor(entityManager) {
        this.em = entityManager;
        this.maxEntities = 10000;

        // 🚀 [Expert Optimization] TypedArray 기반 컴포넌트 데이터 캐싱 (DOD)
        this.transform = new Float32Array(this.maxEntities * 2);
        this.velocity = new Float32Array(this.maxEntities * 4);
        this.stats = new Int32Array(this.maxEntities * 8); 
        this.statsFloat = new Float32Array(this.maxEntities * 4);
        this.state = new Int32Array(this.maxEntities * 2);
        this.job = new Int16Array(this.maxEntities * 2);
        this.render = new Int32Array(this.maxEntities * 8);
        this.alive = new Uint8Array(this.maxEntities);
        this.tag = new Uint32Array(this.maxEntities);
        this.cellKey = new Int32Array(this.maxEntities).fill(-1);
    }

    ensureCapacity(id) {
        if (id < this.maxEntities) return false;
        
        const newMax = Math.max(id + 1, Math.floor(this.maxEntities * 1.5));
        console.log(`📏 ComponentBufferManager: Expanding to ${newMax}...`);

        const newBuffers = {
            transform: new Float32Array(newMax * 2),
            velocity: new Float32Array(newMax * 4),
            stats: new Int32Array(newMax * 8),
            statsFloat: new Float32Array(newMax * 4),
            state: new Int32Array(newMax * 2),
            job: new Int16Array(newMax * 2),
            render: new Int32Array(newMax * 8),
            alive: new Uint8Array(newMax),
            tag: new Uint32Array(newMax),
            cellKey: new Int32Array(newMax).fill(-1)
        };
        
        newBuffers.transform.set(this.transform);
        newBuffers.velocity.set(this.velocity);
        newBuffers.stats.set(this.stats);
        newBuffers.statsFloat.set(this.statsFloat);
        newBuffers.state.set(this.state);
        newBuffers.job.set(this.job);
        newBuffers.render.set(this.render);
        newBuffers.alive.set(this.alive);
        newBuffers.tag.set(this.tag);
        newBuffers.cellKey.set(this.cellKey);
        
        Object.assign(this, newBuffers);
        this.maxEntities = newMax;
        
        this.relinkAll();
        return true;
    }

    relinkAll() {
        for (const [id, entity] of this.em.entities) {
            this.linkEntityComponents(id, entity);
        }
    }

    linkEntityComponents(id, entity) {
        const transform = entity.components.get('Transform');
        const velocity = entity.components.get('Velocity');
        const stats = entity.components.get('BaseStats');
        const health = entity.components.get('Health');
        const aiState = entity.components.get('AIState');
        const jobCtrl = entity.components.get('JobController');
        const visual = entity.components.get('Visual');
        const tag = entity.components.get('TagBitmask');

        if (velocity?.linkBuffer) velocity.linkBuffer(this.velocity, id * 4);
        if (transform?.linkBuffer) {
            transform.linkBuffer(this.transform, id * 2);
            if (velocity) transform.velocity = velocity;
        }
        if (stats?.linkBuffer) stats.linkBuffer(this.stats, id * 8, this.statsFloat, id * 4);
        if (health?.linkBuffer) health.linkBuffer(this.stats, id * 8);
        if (aiState?.linkBuffer) aiState.linkBuffer(this.state, id * 2);
        if (jobCtrl?.linkBuffer) jobCtrl.linkBuffer(this.job, id * 2);
        if (visual?.linkBuffer) visual.linkBuffer(this.render, id * 8);
        if (tag?.linkBuffer) tag.linkBuffer(this.tag, id);
    }

    linkComponent(id, name, component, entity) {
        if (name === 'Transform') {
            if (component.linkBuffer) component.linkBuffer(this.transform, id * 2);
            const velocity = entity.components.get('Velocity');
            if (velocity) component.velocity = velocity;
        } else if (name === 'Velocity') {
            if (component.linkBuffer) component.linkBuffer(this.velocity, id * 4);
            const transform = entity.components.get('Transform');
            if (transform) transform.velocity = component;
        } else if (name === 'BaseStats') {
            if (component.linkBuffer) component.linkBuffer(this.stats, id * 8, this.statsFloat, id * 4);
            const health = entity.components.get('Health');
            if (health?.linkBuffer) health.linkBuffer(this.stats, id * 8);
        } else if (name === 'Health') {
            if (component.linkBuffer) component.linkBuffer(this.stats, id * 8);
            const stats = entity.components.get('BaseStats');
            if (stats?.linkBuffer) stats.linkBuffer(this.stats, id * 8, this.statsFloat, id * 4);
        } else if (name === 'AIState') {
            if (component.linkBuffer) component.linkBuffer(this.state, id * 2);
        } else if (name === 'JobController') {
            if (component.linkBuffer) component.linkBuffer(this.job, id * 2);
        } else if (name === 'Visual') {
            if (component.linkBuffer) component.linkBuffer(this.render, id * 8);
        } else if (name === 'TagBitmask') {
            if (component.linkBuffer) component.linkBuffer(this.tag, id);
        }
    }
}
