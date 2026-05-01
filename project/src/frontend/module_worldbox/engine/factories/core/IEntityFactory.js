/**
 * 🧱 IEntityFactory Interface
 * 모든 구체적인 팩토리가 상속받아야 하는 기본 인터페이스입니다.
 * 리스코프 치환 원칙(LSP)을 준수하며, 일관된 생성 방식을 보장합니다.
 */
export default class IEntityFactory {
    constructor(engine) {
        if (this.constructor === IEntityFactory) {
            throw new Error("Cannot instantiate abstract class IEntityFactory.");
        }
        this.engine = engine;
    }

    /**
     * 엔티티를 생성하고 조립합니다.
     * @param {string} type - 엔티티의 상세 타입 (예: 'sheep', 'human', 'oak_tree')
     * @param {number} x - 생성 위치 X
     * @param {number} y - 생성 위치 Y
     * @param {Object} options - 추가 옵션
     * @returns {number} - 생성된 엔티티 ID
     */
    create(type, x, y, options = {}) {
        throw new Error("Method 'create()' must be implemented.");
    }
}
