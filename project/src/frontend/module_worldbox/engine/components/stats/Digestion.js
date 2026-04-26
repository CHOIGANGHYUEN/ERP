export default class Digestion {
    constructor() {
        this.stomachLevel = 0;    // Current stomach content (filling)
        this.wasteLevel = 0;      // Accumulated waste (excrement)
        this.digestRate = 0.1;    // Speed of digestion per tick
        this.stomachCapacity = 100;
        this.wasteCapacity = 50;
    }
}
