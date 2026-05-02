import Component from '../../core/Component.js';

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
    DIE: 'die'
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
    }

}