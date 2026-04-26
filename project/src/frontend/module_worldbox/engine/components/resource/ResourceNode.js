export default class ResourceNode {
    constructor(type, amount) {
        this.type = type;           // e.g., 'grass', 'tree', 'water'
        this.currentAmount = amount;
        this.maxAmount = amount;
        this.isDepleted = false;
    }

    extract(amount) {
        const actual = Math.min(amount, this.currentAmount);
        this.currentAmount -= actual;
        if (this.currentAmount <= 0) {
            this.isDepleted = true;
        }
        return actual;
    }
}