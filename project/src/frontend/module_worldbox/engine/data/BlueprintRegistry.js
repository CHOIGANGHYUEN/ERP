/**
 * 🏗️ BlueprintRegistry
 * 건물의 종류와 건설 진행도(progress)에 따른 필요 자원 규칙을 중앙 관리합니다.
 * ArchitectRole 등에서 하드코딩된 조건을 제거하여 OCP(개방-폐쇄 원칙)를 달성합니다.
 */
export default class BlueprintRegistry {
    // 📋 건물별 건설 단계(Milestones) 요구 자원 정의
    // progress가 특정 값 미만일 때 적용되는 규칙들
    static requirements = {
        'house': [
            { limit: 50, resource: 'wood' },
            { limit: 100, resource: 'stone' }
        ],
        'well': [
            { limit: 100, resource: 'stone' }
        ],
        'temple': [
            { limit: 100, resource: 'stone' }
        ],
        'watchtower': [
            { limit: 100, resource: 'stone' }
        ],
        'blacksmith': [
            { limit: 40, resource: 'stone' },
            { limit: 100, resource: 'iron_ore' }
        ],
        'warehouse': [
            { limit: 100, resource: 'wood' }
        ],
        'storage': [
            { limit: 100, resource: 'wood' }
        ],
        'fence': [
            { limit: 100, resource: 'wood' }
        ],
        'farm': [
            { limit: 60, resource: 'wood' },
            { limit: 100, resource: 'stone' }
        ],
        'road': [
            { limit: 100, resource: 'wood' }
        ],
        'dirt_road': [
            { limit: 100, resource: 'wood' }
        ],
        'stone_road': [
            { limit: 100, resource: 'stone' }
        ]
    };

    /**
     * 🏗️ 현재 건물의 상태(종류, 진행도)에 따라 필요한 자원 타입을 반환
     * @param {string} buildingType 건물의 타입 (예: 'house')
     * @param {number} progress 현재 건설 진행도 (0-100)
     * @returns {string} 필요 자원 카테고리 (예: 'wood', 'stone')
     */
    static getRequiredResource(buildingType, progress = 0) {
        const rules = this.requirements[buildingType];
        
        // 정의되지 않은 건물이면 기본값 'wood' 반환
        if (!rules || !Array.isArray(rules)) return 'wood';

        // 진행도에 맞는 첫 번째 규칙 탐색
        for (const rule of rules) {
            if (progress < rule.limit) {
                return rule.resource;
            }
        }

        // 모든 한도를 초과했다면 마지막 규칙의 자원 반환
        return rules[rules.length - 1].resource;
    }

    /**
     * 특정 건물을 짓기 위해 필요한 모든 자원 종류 목록 반환 (AI 사전 준비용)
     */
    static getAllRequiredResources(buildingType) {
        const rules = this.requirements[buildingType];
        if (!rules) return ['wood'];
        return [...new Set(rules.map(r => r.resource))];
    }
}
