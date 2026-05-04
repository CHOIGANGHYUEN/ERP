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
        return (this.items[type] || 0) >= amount;
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

    getTotal() {
        return Object.values(this.items).reduce((a, b) => a + b, 0);
    }
}
