import Component from "../../core/Component";
import Pathfinder from "../../utils/Pathfinder";
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

export const StateIndices = {
    'idle': 0, 'wander': 1, 'sleep': 2, 'run': 3, 'flee': 4,
    'evade': 5, 'hunt': 6, 'forage': 7, 'eat': 8, 'graze': 9,
    'pickup': 10, 'die': 11, 'grabbed': 12,

    // Human work states
    'build': 13, 'deposit': 14, 'withdraw': 15,
    'gather_wood': 16, 'gather_plant': 17, 'gather_stone': 18,
    'job_architect': 19, 'job_logger': 20, 'job_gatherer': 21,
    'job_farmer': 22, 'job_transporter': 23, 'wait_target': 24,

    // Non-animal specialized states
    'bee_gather': 25, 'bee_return': 26, 'bee_inside': 27,
    'bee_wander': 28, 'gather': 29, 'attack': 30, 'walk': 31,
    'chief_survey': 32, 'chief_expand': 33, 'chief_inspect': 34,
    'chief_patrol': 35, 'chief_emergency': 36, 'chief_speech': 37,
    'chief_dispatch': 38
};

export const StateNames = [];
for (const [name, index] of Object.entries(StateIndices)) {
    StateNames[index] = name;
}



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
    constructor(options = {}) {
        super('AIState');

        this._buffer = null;
        this._index = -1;

        // 객체로 전달받거나, 단일 문자열로 전달받는 경우 모두 대응
        let initialMode;
        if (typeof options === 'string') {
            initialMode = options;
        } else {
            initialMode = options.mode || AnimalStates.IDLE;
        }
        this._mode = initialMode;

        this.targetId = options.targetId || null;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTarget = null;
        this.stateTimer = 0;
        this.searchCooldown = 0;
        this.modeStack = [];
        this.failedPathCount = 0;
        this.blacklist = new Map();
        this.unreachableTargets = new Set();
        this.searchRange = 0;
        this.targetName = null;
        this.interruptible = options.interruptible !== undefined ? options.interruptible : true;
        this.thinkTimer = 0;
        this.path = null;
        this.pathIndex = 0;
        this.abstractPath = null;
        this.abstractIndex = 0;
        this._path = null;
    }

    /** 🧹 [Expert Optimization] 경로 메모리 관리 */
    get path() {
        return this._path;
    }

    set path(newPath) {
        if (this._path === newPath) return;
        
        // 이전 경로가 있다면 풀에 반환
        if (this._path) {
            Pathfinder.releasePath(this._path);
        }
        
        this._path = newPath;
    }

    reset(options = {}) {
        this._buffer = null;
        this._index = -1;

        const initialMode = typeof options === 'string'
            ? options
            : (options.mode || AnimalStates.IDLE);

        this._mode = initialMode;
        this.targetId = options.targetId || null;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTarget = null;
        this.stateTimer = 0;
        this.searchCooldown = 0;
        this.modeStack = [];
        this.failedPathCount = 0;
        this.blacklist = new Map();
        this.unreachableTargets = new Set();
        this.searchRange = 0;
        this.targetName = null;
        this.interruptible = options.interruptible !== undefined ? options.interruptible : true;
        this.thinkTimer = 0;
        
        // 경로 초기화 및 반환
        if (this._path) {
            Pathfinder.releasePath(this._path);
        }
        this._path = null;

        this.pathIndex = 0;
        this.abstractPath = null;
        this.abstractIndex = 0;
        this.isTargetRequested = false;
        this.targetRequestFailed = false;
        this.targetResourceType = null;
        this.storageTargetId = null;
        this.previousMode = null;
        this.pathTargetId = null;
        this.lastPathCalcTime = 0;
        this.timer = 0;
        this.retryTimer = 0;
        this.chopTimer = 0;
        this.chopInterval = null;
        this.isChopping = false;
        this.fallingTargetId = null;
        this.fallTimer = 0;
        this.lastHarvestedItemId = null;
        this.animTimer = 0;
        this.waitTimer = 0;
        this.idleWaitTimer = undefined;
        this._buildProgressCounter = 0;
        this.canSearchThisFrame = false;
        this.lastRequestTime = 0;
    }

    /** 🚀 [Expert Optimization] 버퍼 연결 */
    linkBuffer(buffer, index) {
        const isFirstLink = (this._buffer === null);
        this._buffer = buffer;
        this._index = index;
        
        if (isFirstLink && this._buffer) {
            this._buffer[this._index] = StateIndices[this._mode] ?? StateIndices[AnimalStates.IDLE];
            this._updateBitmask();
        }
    }

    _updateBitmask() {
        if (!this._buffer) return;
        let mask = 0;
        if (this._mode === 'grabbed') mask |= 1;
        if (this._mode === 'die') mask |= 2;
        this._buffer[this._index + 1] = mask;
    }

    get mode() {
        return this._mode;
    }

    set mode(v) {
        this._mode = v || AnimalStates.IDLE;
        if (this._buffer) {
            this._buffer[this._index] = StateIndices[this._mode] ?? StateIndices[AnimalStates.IDLE];
            this._updateBitmask();
        }
    }

    /** 🚫 타겟을 일시적 블랙리스트에 추가 */
    addToBlacklist(targetId, duration = 10) {
        const expiration = Date.now() + (duration * 1000);
        this.blacklist.set(targetId, expiration);
        this.unreachableTargets.add(targetId);
    }

    /** 🔍 블랙리스트 여부 확인 (만료 체크 포함) */
    isBlacklisted(targetId) {
        if (!this.blacklist.has(targetId)) return false;
        if (Date.now() > this.blacklist.get(targetId)) {
            this.blacklist.delete(targetId);
            this.unreachableTargets.delete(targetId);
            return false;
        }
        return true;
    }

    /** 🧹 만료된 블랙리스트 항목 정리 */
    pruneBlacklist() {
        const now = Date.now();
        for (const [id, expiry] of this.blacklist.entries()) {
            if (now > expiry) {
                this.blacklist.delete(id);
                this.unreachableTargets.delete(id);
            }
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
