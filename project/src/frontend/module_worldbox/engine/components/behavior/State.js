import Component from "../../core/Component";
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
    constructor(options = {}) {
        super('AIState');

        // 객체로 전달받거나, 단일 문자열로 전달받는 경우 모두 대응
        if (typeof options === 'string') {
            this.mode = options;
        } else {
            this.mode = options.mode || AnimalStates.IDLE;
        }

        this.targetId = options.targetId || null;         // 상호작용 중인 타겟 Entity ID (사냥감, 채집물 등)
        this.wanderAngle = Math.random() * Math.PI * 2; // 배회(Wander) 방향 (무작위)
        this.stateTimer = 0;          // 특정 상태(대기, 휴식 등)에 머문 시간 기록용
        this.searchCooldown = 0;      // 먹이 탐색 쿨다운

        // 🧠 [Ecological Cycle Update] 상태 스택 (인터럽트 대응)
        this.modeStack = [];

        this.failedPathCount = 0;      // 현재 타겟에 대한 경로 탐색 실패 횟수
        this.blacklist = new Map();    // { targetId: expirationTime } - 일시적 무시 대상 목록
        this.unreachableTargets = new Set(); // 🚫 [Stability] 경로 탐색 실패 타겟 캐시 (Set 유지)

        this.searchRange = 0;          // 최근 탐색 반경
        this.targetName = null;        // 현재 타겟의 명칭 (UI/디버그용)
        this.interruptible = options.interruptible !== undefined ? options.interruptible : true; // 🛡️ 상태 중단 가능 여부
        this.thinkTimer = 0;      // 🧠 판단 주기 타이머 (Throttling)
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
