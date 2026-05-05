import Component from '../../core/Component.js';
import { MODE_NAME_TO_ID, SHARED_LAYOUT } from '../../core/Constants.js';

/**
 * 🐾 Animal States
 */
export const AnimalStates = {
    IDLE: 'idle',    // 정지 대기 상태
    WANDER: 'wander', // 경로 탐색 기반 배회 상태
    SLEEP: 'sleep',
    RUN: 'run',
    FLEE: 'flee',
    EVADE: 'evade',
    HUNT: 'hunt',
    FORAGE: 'forage',
    EAT: 'eat',
    GRAZE: 'graze',
    PICKUP: 'pickup',
    DIE: 'die',
    GRABBED: 'grabbed'
};

/**
 * 🥩 Diet Types
 */
export const DietType = {
    HERBIVORE: 'herbivore',
    CARNIVORE: 'carnivore',
    OMNIVORE: 'omnivore'
};

/**
 * 🧠 AI State Component (FSM Data)
 */
export default class State extends Component {
    constructor(options = {}) {
        super('AIState');

        this._mode = AnimalStates.IDLE;
        if (typeof options === 'string') {
            this._mode = options;
        } else {
            this._mode = options.mode || AnimalStates.IDLE;
        }

        this.targetId = options.targetId || null;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.stateTimer = 0;
        this.searchCooldown = 0;

        this.modeStack = [];
        this.failedPathCount = 0;
        this.blacklist = new Map();

        // 🛰️ Shared Buffer Support
        this.sharedIntData = null;
        this.stride = 0;
        this.index = -1;
    }

    setSharedData(data, intData, stride, index) {
        this.sharedIntData = intData;
        this.stride = stride;
        this.index = index;
        this.syncMode();
    }

    get mode() { return this._mode; }
    set mode(val) {
        this._mode = val;
        this.syncMode();
    }

    syncMode() {
        if (this.sharedIntData && this.index !== -1) {
            this.sharedIntData[this.index * this.stride + SHARED_LAYOUT.MODE_ID] = MODE_NAME_TO_ID[this._mode] || 0;
        }
    }

    pushMode(nextMode) {
        if (this.mode === nextMode) return;
        this.modeStack.push(this.mode);
        this.mode = nextMode;
        this.stateTimer = 0;
    }

    popMode() {
        if (this.modeStack.length > 0) {
            this.mode = this.modeStack.pop();
        } else {
            this.mode = 'idle';
        }
        this.stateTimer = 0;
    }
}
