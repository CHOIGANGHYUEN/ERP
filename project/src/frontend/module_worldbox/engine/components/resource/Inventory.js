import Component from '../../core/Component.js';

/**
 * 📦 Inventory Component
 * 개체가 보유한 아이템과 자원을 관리합니다.
 */
export default class Inventory extends Component {
    constructor(capacity = 100) {
        super('Inventory');
        this.items = {}; // 📦 [Flexibility] 특정 키에 얽매이지 않고 동적으로 모든 자원 수용
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

    has(type, amount) {
        // 🔍 [Expert Logic] 특정 타입이 없으면 유사한 카테고리 자원을 검색할 수도 있음 (향후 확장 가능)
        return (this.items[type] || 0) >= amount;
    }

    consume(type, amount) {
        if (this.has(type, amount)) {
            this.items[type] -= amount;
            if (this.items[type] <= 0) delete this.items[type];
            return true;
        }
        return false;
    }

    getTotal() {
        return Object.values(this.items).reduce((a, b) => a + b, 0);
    }
}
