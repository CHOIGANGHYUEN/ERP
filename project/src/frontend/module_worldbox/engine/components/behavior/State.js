import Component from "../../core/Component";
import { MODE_TYPES } from "../../core/BufferManager.js";

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
 * 
 * 개체의 현재 행동 상태와 관련 데이터를 저장하는 순수 데이터 컴포넌트.
 * 비즈니스 로직은 포함하지 않으며, AnimalBehaviorSystem 및 개별 FSM State 모듈들이 이 데이터를 읽고 씁니다.
 */
export default class State extends Component {
    constructor(options = null, entityId = -1, bufferManager = null) {
        super('AIState');
        this.entityId = entityId;
        this.bufferManager = bufferManager;

        // 초기 모드 설정
        let initialMode = null;
        if (options && (typeof options === 'string' || Object.keys(options).length > 0)) {
            initialMode = (typeof options === 'string') ? options : (options.mode || AnimalStates.IDLE);
        }
        
        if (bufferManager && entityId !== -1) {
            if (initialMode !== null) this.mode = initialMode;
        } else {
            this._mode = initialMode || AnimalStates.IDLE;
        }

        this.targetId = options?.targetId || null;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.stateTimer = 0;
        this.searchCooldown = 0;
        this.modeStack = [];
        this.failedPathCount = 0;
        this.blacklist = new Map();
    }

    get mode() {
        if (!this.bufferManager) return this._mode;
        return MODE_TYPES[this.bufferManager.mode[this.entityId]] || 'idle';
    }

    set mode(val) {
        if (this.bufferManager) {
            let idx = MODE_TYPES.indexOf(val);
            if (idx === -1) idx = MODE_TYPES.indexOf('unknown');
            this.bufferManager.mode[this.entityId] = idx;
        } else {
            this._mode = val;
        }
    }

    /**
     * 🚀 현재 상태를 스택에 저장하고 새로운 상태로 전환합니다. (인터럽트)
     */
    pushMode(nextMode) {
        if (this.mode === nextMode) return;
        this.modeStack.push(this.mode);
        this.mode = nextMode;
        this.stateTimer = 0; // 타이머 초기화
    }

    /**
     * 🔙 이전 상태로 복구합니다. 스택이 비어있으면 IDLE로 돌아갑니다.
     */
    popMode() {
        if (this.modeStack.length > 0) {
            this.mode = this.modeStack.pop();
        } else {
            this.mode = 'idle';
        }
        this.stateTimer = 0;
    }
}
