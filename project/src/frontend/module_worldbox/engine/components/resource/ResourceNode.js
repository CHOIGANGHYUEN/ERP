/**
 * 🪨 ResourceNode Component
 * 모든 채집 가능한 자원의 상태를 관리합니다.
 * 명세에 따라 캡슐화 및 자체 파기 로직(이벤트 버스, 엔티티 매니저 호출)이 내재화되었습니다.
 */
export default class ResourceNode {
    constructor(type, amount) {
        this.type = type;
        this.value = amount;           // 현재 남은 양
        this.maxAmount = amount;
        this.isDepleted = false;
        
        // AI 인지를 위한 플래그 (속성 기반 자동 설정)
        const lowerType = type.toLowerCase();
        this.isTree = lowerType.includes('tree') || lowerType.includes('wood');
        
        // 동물/인간이 식용 가능한 자원 목록
        this.edible = lowerType.includes('berry') || 
                      lowerType.includes('fruit') || 
                      lowerType.includes('wheat') || 
                      lowerType.includes('plant') ||
                      lowerType.includes('grass') ||
                      lowerType.includes('flower') ||
                      lowerType.includes('shrub');
                      
        this.isMineral = lowerType.includes('stone') || lowerType.includes('iron') || lowerType.includes('gold');
        
        // 식물의 비옥도 등 제로섬 로직을 위한 속성
        this.storedFertility = this.edible ? amount / 100 : undefined; 
    }

    /**
     * 자원 채집 메서드 (데이터 캡슐화)
     * @param {number} amount - 목표 채집량
     * @param {object} eventBus - 시각 효과 발생을 위한 이벤트 버스
     * @param {object} entityManager - 자폭 시 호출할 엔티티 매니저
     * @param {number} entityId - 자폭 시 삭제할 본인의 ID
     * @param {object} transform - 파티클 발생 위치
     * @param {number} dx - 벌목 시 쓰러지는 방향 등을 위한 X 거리 차 (선택)
     * @returns {number} 실제 획득량
     */
    extract(amount, eventBus = null, entityManager = null, entityId = null, transform = null, dx = 0) {
        if (this.isDepleted) return 0;

        let actual = 0;

        // 제로섬 기반 비옥도 계산 (캡슐화 위임)
        if (this.storedFertility !== undefined && this.edible) {
            actual = Math.min(amount, this.storedFertility * 100);
            this.storedFertility -= actual / 100;
            this.value = this.storedFertility * 100;
        } else {
            actual = Math.min(amount, this.value);
            this.value -= actual;
        }

        // 고갈 체크
        if (this.value <= 0 || (this.storedFertility !== undefined && this.storedFertility <= 0.05)) {
            this.value = 0;
            if (this.storedFertility !== undefined) this.storedFertility = 0;
            this.isDepleted = true;

            // 시각 효과 발생 책임 병합
            if (eventBus && transform) {
                if (this.isTree) {
                    this.isFalling = true;
                    this.fallProgress = 0;
                    this.fallDirection = dx >= 0 ? 1 : -1;
                    
                    eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: transform.x, y: transform.y,
                        count: 15, type: 'EFFECT', color: '#5d4037', speed: 5
                    });
                    eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: transform.x, y: transform.y,
                        count: 10, type: 'DUST', color: '#bcaaa4', speed: 2
                    });
                } else if (this.isMineral) {
                    eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: transform.x, y: transform.y,
                        count: 10, type: 'EFFECT', color: '#9e9e9e', speed: 4
                    });
                } else {
                    eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: transform.x, y: transform.y,
                        count: 5, type: 'EFFECT', color: '#4caf50', speed: 2
                    });
                }
            }

            // 고갈 시점에 스스로 EntityManager에 자폭 요청
            if (entityManager && entityId !== null) {
                entityManager.removeEntity(entityId);
            }
        } else {
            // 채집 중 파티클
            if (eventBus && transform && this.isTree) {
                eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x, y: transform.y - 5,
                    count: 3, type: 'EFFECT', color: '#795548', speed: 3
                });
            }
        }

        return actual;
    }
}
