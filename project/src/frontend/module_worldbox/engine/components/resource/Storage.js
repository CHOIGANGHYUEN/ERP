import Component from '../../core/Component.js';

/**
 * 📦 Storage Component
 * 건축물(창고, 농장 등)의 아이템 보관 상태를 관리합니다.
 */
export default class Storage extends Component {
    constructor(options = {}) {
        super('Storage');
        this.capacity = options.capacity || 1000;
        this.items = options.items || {}; // { wood: 10, food: 5, ... }
        this.isFull = false;
    }

    addItem(type, amount) {
        const currentTotal = this.getTotalItems();
        const availableSpace = this.capacity - currentTotal;
        const actualAdd = Math.min(amount, availableSpace);

        if (actualAdd > 0) {
            this.items[type] = (this.items[type] || 0) + actualAdd;
            this._updateFullStatus();
            return actualAdd;
        }
        return 0;
    }

    removeItem(type, amount) {
        if (this.items[type] && this.items[type] >= amount) {
            this.items[type] -= amount;
            this._updateFullStatus();
            return amount;
        }
        return 0;
    }

    getTotalItems() {
        return Object.values(this.items).reduce((sum, val) => sum + val, 0);
    }

    _updateFullStatus() {
        this.isFull = this.getTotalItems() >= this.capacity;
    }
}
