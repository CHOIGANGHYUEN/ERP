import Component from '../../core/Component.js';

/**
 * 📦 Storage Component
 * 건축물(창고, 농장 등)의 아이템 보관 상태를 관리합니다.
 */
export default class Storage extends Component {
    constructor(options = {}) {
        super('Storage');
        this.capacity = options.capacity || 1000;
        this.items = options.items || {}; // { type: count }
        this.isFull = false;
    }

    addItem(type, amount) {
        const currentTotal = this.getTotalItems();
        const availableSpace = this.capacity - currentTotal;
        const actualAdd = Math.min(amount, availableSpace);

        if (actualAdd > 0) {
            this.items[type] = (this.items[type] || 0) + actualAdd;
            this._updateStatus();
            return actualAdd;
        }
        return 0;
    }

    has(type, amount) {
        return (this.items[type] || 0) >= amount;
    }

    withdraw(type, amount) {
        const available = this.items[type] || 0;
        const actualWithdraw = Math.min(available, amount);
        if (actualWithdraw > 0) {
            this.items[type] -= actualWithdraw;
            if (this.items[type] <= 0) delete this.items[type];
            this._updateStatus();
            return actualWithdraw;
        }
        return 0;
    }

    getTotalItems() {
        return Object.values(this.items).reduce((sum, val) => sum + val, 0);
    }

    _updateStatus() {
        const total = this.getTotalItems();
        this.isFull = total >= this.capacity;
        this.isLow = total < this.capacity * 0.1;
        
        if (this.entity && this.entity.entityManager && this.entity.entityManager.eventBus) {
            this.entity.entityManager.eventBus.emit('STORAGE_CHANGED', { 
                entityId: this.entity.id, 
                items: this.items 
            });
        }
    }
}
