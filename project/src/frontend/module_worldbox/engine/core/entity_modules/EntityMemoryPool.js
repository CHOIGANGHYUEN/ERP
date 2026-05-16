/**
 * ♻️ EntityMemoryPool
 * 엔티티 ID의 발급, 재사용(Pool), 활성 ID 관리(Dense Array)를 담당합니다.
 * EntityManager.js에서 SRP에 따라 분리되었습니다.
 */
export default class EntityMemoryPool {
    constructor(entityManager) {
        this.em = entityManager;
        this.nextId = 0;
        this.freeIds = [];
        this.denseIds = [];
    }

    acquireId() {
        let id;
        if (this.freeIds.length > 0) {
            id = this.freeIds.pop();
        } else {
            id = this.nextId++;
            // 용량 확장은 BufferManager가 담당
            this.em.buffers.ensureCapacity(id);
        }
        
        this.em.buffers.alive[id] = 1;
        this.denseIds.push(id);
        return id;
    }

    releaseId(id, entity) {
        // Dense Array Swap (Defragmentation)
        const idx = entity.denseIndex;
        const lastId = this.denseIds.pop();
        if (id !== lastId) {
            this.denseIds[idx] = lastId;
            const lastEntity = this.em.entities.get(lastId);
            if (lastEntity) lastEntity.denseIndex = idx;
        }

        this.em.buffers.alive[id] = 0;
        this.freeIds.push(id);
    }

    clear() {
        this.freeIds = [];
        this.denseIds = [];
        this.nextId = 0;
    }
}
