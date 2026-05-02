import Component from '../../core/Component.js';

/**
 * 🚪 Door Component
 * 울타리 문(Gate) 등의 개폐 상태를 관리합니다.
 */
export default class Door extends Component {
    constructor(options = {}) {
        super('Door');
        this.isOpen = options.isOpen || false;
        this.autoClose = options.autoClose !== undefined ? options.autoClose : true;
        this.autoCloseDelay = options.autoCloseDelay || 3000; // 3초 후 자동 닫힘
        this.lastOpenTime = 0;
    }

    open() {
        this.isOpen = true;
        this.lastOpenTime = Date.now();
    }

    close() {
        this.isOpen = false;
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
        return this.isOpen;
    }
}
