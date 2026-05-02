/**
 * 🪵 Resource Component
 * 모든 채집 가능한 자원의 상태를 관리합니다.
 * 명칭과 속성을 통합하여 AI 인지 오류를 방지합니다.
 */
export default class Resource {
    constructor(type, amount) {
        this.type = type;
        this.value = amount;           // 현재 남은 양
        this.maxAmount = amount;
        this.isDepleted = false;
        
        // AI 인지를 위한 플래그 (속성 기반 자동 설정)
        const lowerType = type.toLowerCase();
        this.isTree = lowerType.includes('tree') || lowerType.includes('wood');
        
        // 🍎 식용 가능한 자원 목록 (풀, 꽃, 열매 등)
        this.edible = lowerType.includes('berry') || 
                      lowerType.includes('fruit') || 
                      lowerType.includes('wheat') || 
                      lowerType.includes('plant') ||
                      lowerType.includes('grass') ||
                      lowerType.includes('flower') ||
                      lowerType.includes('shrub');
                      
        this.isMineral = lowerType.includes('stone') || lowerType.includes('iron') || lowerType.includes('gold');
    }

    extract(amount) {
        const actual = Math.min(amount, this.value);
        this.value -= actual;
        if (this.value <= 0) {
            this.value = 0;
            this.isDepleted = true;
        }
        return actual;
    }
}
