/**
 * 🔧 BaseRole
 * 모든 직업 Role 클래스의 기반 추상 클래스.
 * 각 Role은 자신의 판단 로직(decide)을 통해 엔티티의 AIState를 갱신합니다.
 */
export default class BaseRole {
    /**
     * @param {object} system - HumanBehaviorSystem 참조 (engine, em 접근용)
     */
    constructor(system) {
        this.system = system;
        this.engine = system.engine;
        this.em     = system.entityManager;
    }

    /**
     * 매 틱 호출. 엔티티의 현재 상태를 보고 AIState를 갱신합니다.
     * @param {object} entity - 판단 대상 엔티티
     * @param {number} dt
     * @returns {string|null} 다음 state 이름, 또는 null (현재 상태 유지)
     */
    decide(entity, dt) {
        return null;
    }
}
