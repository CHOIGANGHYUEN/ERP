import Component from '../../core/Component.js';

export default class TechLevel extends Component {
    constructor() {
        super('TechLevel');
        this.level = 0;
        this.population = 0;
        this.gatheredWood = 0;
        this.survivedTime = 0;
    }
}
