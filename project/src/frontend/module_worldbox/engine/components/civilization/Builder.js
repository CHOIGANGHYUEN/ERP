import Component from '../../core/Component.js';

export default class Builder extends Component {
    constructor() {
        super('Builder');
        this.buildSpeed = 10; // 자원을 투입하여 완성도를 높이는 속도 (초당)
    }
}
