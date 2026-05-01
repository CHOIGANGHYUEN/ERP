import Component from '../../core/Component.js';

/**
 * 💰 Wealth Component
 * 개체나 세력의 재산(화폐)을 관리합니다.
 */
export default class Wealth extends Component {
    constructor(options = {}) {
        super('Wealth');
        this.gold = options.gold || 0;
        this.totalEarned = options.totalEarned || 0;
        this.totalSpent = options.totalSpent || 0;
    }

    addGold(amount) {
        this.gold += amount;
        if (amount > 0) this.totalEarned += amount;
    }

    spendGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            this.totalSpent += amount;
            return true;
        }
        return false;
    }
}
