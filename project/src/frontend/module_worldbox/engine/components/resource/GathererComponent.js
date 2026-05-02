export default class GathererComponent {
    constructor(config = {}) {
        this.gatherSpeed = config.gatherSpeed || 5.0; // 기본 채집 속도
    }

    /**
     * 타겟 엔티티로부터 자원을 채집합니다.
     * @param {number} dt - 델타 타임
     * @param {object} targetEntity - 타겟 엔티티
     * @param {number} targetId - 타겟 엔티티 ID
     * @param {object} entityManager - 엔티티 매니저
     * @param {object} eventBus - 이벤트 버스
     * @param {object} myTransform - 현재 내 위치 (채집 방향/파티클 계산용)
     * @returns {number} 실제 채집된 자원량
     */
    performGathering(dt, targetEntity, targetId, entityManager, eventBus, myTransform) {
        if (!targetEntity) return 0;
        
        const resourceNode = targetEntity.components.get('Resource');
        if (!resourceNode || typeof resourceNode.extract !== 'function') return 0;

        const targetPos = targetEntity.components.get('Transform');
        const dx = targetPos && myTransform ? targetPos.x - myTransform.x : 0;
        
        // 목표 채집량 계산
        const amountToGather = this.gatherSpeed * dt;
        
        // 실제 획득량 반환
        return resourceNode.extract(amountToGather, eventBus, entityManager, targetId, targetPos, dx);
    }
}