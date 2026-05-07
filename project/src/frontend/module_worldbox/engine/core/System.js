/**
 * ⚙️ Base System Class
 * 
 * ECS 원칙 절대 준수:
 * System은 전역 `Engine` 객체(God Object)를 직접 참조하거나 UI/렌더링(Canvas)을 직접 조작해선 안 됩니다.
 * 생성자를 통해 주입받은 `EntityManager`의 컴포넌트 데이터를 읽고 쓰며, 필요한 상호작용은 `EventBus`를 통해 던집니다.
 */
export default class System {
    constructor(entityManager, eventBus) {
        if (!entityManager) throw new Error("System requires an EntityManager");
        this.entityManager = entityManager;
        this.eventBus = eventBus || null;
        this.requiredMask = 0; // 🏷️ [DOD] 시스템이 처리할 컴포넌트 비트마스크
    }

    /** 🚀 [Expert Optimization] 비트마스크 기반 고속 필터링 */
    getFilteredIndices(mask) {
        const em = this.entityManager;
        const tagBuffer = em.tagBuffer;
        const aliveBuffer = em.aliveBuffer;
        const result = [];
        
        // TypedArray를 순회하며 비트 연산으로 필터링 (JS 엔진의 SIMD 최적화 활용 가능)
        for (let i = 0; i < em.nextId; i++) {
            if (aliveBuffer[i] && (tagBuffer[i] & mask) === mask) {
                result.push(i);
            }
        }
        return result;
    }

    update(dt, time) {
        throw new Error("System subclasses must implement the update(dt, time) method.");
    }
}