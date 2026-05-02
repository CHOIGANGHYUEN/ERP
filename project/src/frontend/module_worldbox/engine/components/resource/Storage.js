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
            this._updateStatus();
            return actualAdd;
        }
        return 0;
    }

    removeItem(type, amount) {
        if (this.items[type] && this.items[type] >= amount) {
            this.items[type] -= amount;
            this._updateStatus();
            return amount;
        }
        return 0;
    }

    /**
     * 특정 자원을 명시적으로 인출 (소비자용)
     */
    withdraw(type, amount) {
        const available = this.items[type] || 0;
        const actualWithdraw = Math.min(available, amount);
        if (actualWithdraw > 0) {
            this.items[type] -= actualWithdraw;
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
        this.isLow = total < this.capacity * 0.1; // 10% 미만이면 저재고 상태
        
        // 전역 이벤트를 통해 재고 변경 알림 (EconomyManager 등이 수신 가능)
        if (this.entity && this.entity.entityManager && this.entity.entityManager.eventBus) {
            this.entity.entityManager.eventBus.emit('STORAGE_CHANGED', { 
                entityId: this.entity.id, 
                items: this.items 
            });
        }
    }
}
