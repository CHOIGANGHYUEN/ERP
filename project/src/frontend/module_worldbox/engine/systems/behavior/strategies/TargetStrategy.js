/**
 * 🎯 TargetStrategy (Base Class)
 * 특정 타입의 타겟을 탐색하는 알고리즘의 인터페이스를 정의합니다.
 * Strategy Pattern을 적용하여 TargetManager의 복잡도를 낮춥니다.
 */
export default class TargetStrategy {
    /**
     * @param {TargetManager} manager 
     * @param {Entity} entity 타겟을 찾는 주체 엔티티
     * @param {Object} transform 주체의 Transform 컴포넌트
     * @param {Object} criteria 탐색 조건 (resourceType 등)
     * @param {string} intent 행동 목적 (build, gather 등)
     * @param {boolean} forceGlobal 구역 제한을 무시하고 전역 탐색할지 여부
     */
    execute(manager, entity, transform, criteria, intent, forceGlobal = false) {
        throw new Error('TargetStrategy.execute() must be implemented by subclass');
    }

    /**
     * 주체의 구역 정보를 가져옵니다.
     */
    getZone(manager, entity, intent) {
        return manager._getZone(entity, intent);
    }

    /**
     * 특정 좌표가 구역 내에 있는지 확인합니다.
     */
    isInZone(manager, x, y, zone) {
        return manager._isInZone(x, y, zone);
    }
}
