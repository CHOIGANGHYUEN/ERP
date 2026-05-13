import Component from '../../core/Component.js';

/**
 * 📦 Inventory Component
 * 개체가 보유한 아이템과 자원을 관리합니다.
 */
export default class Inventory extends Component {
    constructor(capacity = 100) {
        super('Inventory');
        this.items = {}; // { itemId: count } - 이제 itemId는 주로 'wood', 'stone' 등 표준 타입명이 됩니다.
        this.capacity = capacity;
    }

    add(type, amount) {
        const current = this.items[type] || 0;
        const total = this.getTotal();
        const available = this.capacity - total;

        const actualAdd = Math.min(amount, available);
        if (actualAdd > 0) {
            this.items[type] = current + actualAdd;
        }
        return actualAdd;
    }

    /**
     * 표준화된 ID(Type)로 자원 존재 여부 확인
     */
    has(type, amount) {
        if (!type) return false;
        return (this.items[type] || 0) >= (amount || 0);
    }

    /**
     * 🚀 [Expert AI] 유연한 자원 존재 여부 확인 (카테고리 및 유사어 포함)
     */
    hasFlexible(type, amount) {
        if (!type) return false;
        const req = type.toLowerCase();
        const amt = amount || 0;
        
        // 1. 직접 타입 일치 확인
        if ((this.items[type] || 0) >= amt) return true;

        // 2. 유사 속성/카테고리 확인
        for (const [iType, count] of Object.entries(this.items)) {
            if (count < amt) continue;
            
            const lowerType = iType.toLowerCase();
            if (lowerType === req) return true;

            // 돌(stone) 매칭: mineral, rock 등
            if (req === 'stone' && (lowerType.includes('stone') || lowerType.includes('rock') || lowerType.includes('mineral'))) return true;
            // 나무(wood) 매칭: log, timber 등
            if (req === 'wood' && (lowerType.includes('wood') || lowerType.includes('log') || lowerType.includes('timber'))) return true;
            // 철(iron) 매칭: ore, metal 등
            if (req === 'iron_ore' && (lowerType.includes('iron') || lowerType.includes('ore') || lowerType.includes('metal'))) return true;
            // 식량(food) 매칭
            if (req === 'food' && (lowerType === 'fruit' || lowerType === 'meat' || lowerType === 'berry' || lowerType === 'bread')) return true;
        }

        return false;
    }



    /**
     * 표준화된 ID(Type)로 자원 소모
     */
    consume(type, amount) {
        if (this.has(type, amount)) {
            this.items[type] -= amount;
            if (this.items[type] <= 0) delete this.items[type];
            return true;
        }
        return false;
    }

    /** 자원을 제거합니다. consume가 불가시에도 동작 (음수 방지). */
    remove(type, amount) {
        const current = this.items[type] || 0;
        const removed = Math.min(current, amount);
        if (removed > 0) {
            this.items[type] = current - removed;
            if (this.items[type] <= 0) delete this.items[type];
        }
        return removed;
    }

    getTotal() {
        return Object.values(this.items).reduce((a, b) => a + b, 0);
    }
}
