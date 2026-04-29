import Component from '../../core/Component.js';

export default class Inventory extends Component {
    constructor(capacity = 100) {
        super('Inventory');
        this.items = {
            wood: 0,
            food: 0,
            stone: 0
        };
        this.capacity = capacity;
    }

    add(type, amount) {
        const current = this.items[type] || 0;
        const total = Object.values(this.items).reduce((a, b) => a + b, 0);
        const available = this.capacity - total;
        
        const actualAdd = Math.min(amount, available);
        if (actualAdd > 0) {
            this.items[type] = current + actualAdd;
        }
        return actualAdd;
    }

    has(type, amount) {
        return (this.items[type] || 0) >= amount;
    }

    consume(type, amount) {
        if (this.has(type, amount)) {
            this.items[type] -= amount;
            return true;
        }
        return false;
    }

    getTotal() {
        return Object.values(this.items).reduce((a, b) => a + b, 0);
    }
}
