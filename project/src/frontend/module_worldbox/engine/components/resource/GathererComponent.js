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
        const health = targetEntity.components.get('Health');
        if (health) {
            // 🪓 채집 속도에 비례하여 체력 감소 (도끼질/곡괭이질 효과)
            const damage = this.gatherSpeed * dt * 2; // 밸런스 조절 가능
            health.takeDamage(damage);
        }

        const resourceNode = targetEntity.components.get('Resource');
        if (!resourceNode || typeof resourceNode.extract !== 'function') return 0;

        const targetPos = targetEntity.components.get('Transform');
        const dx = targetPos && myTransform ? targetPos.x - myTransform.x : 0;
        
        // 목표 채집량 계산 (이제는 즉시 획득이 아니라 타격 루프의 일부로 동작)
        const amountToGather = this.gatherSpeed * dt;
        
        // 실제 획득량 반환 (Health 시스템 도입으로 인해 0을 반환하거나 최소량만 반환하도록 변경 가능)
        // 여기서는 시각 효과 파티클 생성을 위해 extract를 호출하되, 실제 획득은 나중에 드랍된 아이템으로 처리함.
        return resourceNode.extract(amountToGather, eventBus, entityManager, targetId, targetPos, dx);
    }
}