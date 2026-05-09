import Component from '../../core/Component.js';

export default class Structure extends Component {
    constructor(type, maxProgress = 100, maxHp = 100) {
        super('Structure');
        this.type = type;
        this.progress = 0;
        this.maxProgress = maxProgress;
        this.isComplete = false;
        this.hp = maxHp;
        this.maxHp = maxHp;
        this.villageId = -1;
        this.influence = 0; // 🏰 영토 확장 기여도
        this.defense = 0;   // 🛡️ 방어력 기여도
    }
}
