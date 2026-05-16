/**
 * 🏷️ ResourceRegistry
 * 자원의 속성, 유사어(Alias), 카테고리 매칭 로직을 중앙에서 관리합니다.
 * SRP(단일 책임 원칙)를 준수하여 Inventory나 AI Role 클래스에서 매칭 로직을 분리합니다.
 */
export default class ResourceRegistry {
    // 🎭 자원 타입별 유사어 및 카테고리 맵
    static aliases = {
        'stone': ['stone', 'rock', 'mineral', 'gravel', 'flint', 'granite', 'obsidian', 'ore'],
        'wood': ['wood', 'log', 'timber', 'stick', 'branch', 'plank', 'tree', 'forest'],
        'iron_ore': ['iron', 'ore', 'metal', 'copper', 'silver', 'gold', 'hematite'],
        'food': ['fruit', 'meat', 'berry', 'bread', 'apple', 'grain', 'fish', 'vegetable', 'mushroom', 'herb', 'plant']
    };

    /**
     * 🎯 자원 타입이 특정 카테고리나 목표 타입에 매칭되는지 확인
     * @param {string} resourceType 실제 자원 이름 (예: 'rock_01')
     * @param {string} targetCategory 찾고자 하는 카테고리 (예: 'stone')
     */
    static isMatch(resourceType, targetCategory) {
        if (!resourceType || !targetCategory) return false;

        const res = resourceType.toLowerCase();
        const tar = targetCategory.toLowerCase();

        // 1. 완전 일치
        if (res === tar) return true;

        // 2. 포함 관계 확인 (예: 'oak_wood' includes 'wood')
        if (res.includes(tar)) return true;

        // 3. 에일리어스(별칭) 목록 확인
        const aliasList = this.aliases[tar];
        if (aliasList) {
            return aliasList.some(alias => res.includes(alias));
        }

        // 4. 역방향 확인 (카테고리명이 타입명에 포함되는 경우 등)
        if (tar.includes(res) && res.length > 2) return true;

        return false;
    }

    /**
     * 특정 카테고리에 속한 모든 에일리어스 목록 반환
     */
    static getAliases(category) {
        return this.aliases[category.toLowerCase()] || [];
    }

    /**
     * 📦 인벤토리 내의 자원들 중 타겟 카테고리에 맞는 것이 있는지 검사
     * @param {Object} items Inventory.items 객체 { type: count }
     * @param {string} targetCategory 찾고자 하는 카테고리
     * @param {number} requiredAmount 필요 수량
     */
    static hasMatchInItems(items, targetCategory, requiredAmount = 1) {
        for (const [type, count] of Object.entries(items)) {
            if (count >= requiredAmount && this.isMatch(type, targetCategory)) {
                return true;
            }
        }
        return false;
    }
}
