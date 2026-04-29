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
        this.eventBus = eventBus || null; // 추후 필수 파라미터로 강제
    }

    update(dt, time) {
        throw new Error("System subclasses must implement the update(dt, time) method.");
    }
}