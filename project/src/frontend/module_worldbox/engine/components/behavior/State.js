import Component from '../../core/Component.js';

/**
 * 🧠 AI State Component (FSM Data)
 * 
 * 개체의 현재 행동 상태와 관련 데이터를 저장하는 순수 데이터 컴포넌트.
 * 비즈니스 로직은 포함하지 않으며, AnimalBehaviorSystem 및 개별 FSM State 모듈들이 이 데이터를 읽고 씁니다.
 */
export default class State extends Component {
    constructor(initialMode = 'wander') {
        super('AIState');

        this.mode = initialMode;      // 현재 상태 ('wander', 'hunt', 'eat', 'flee', 'bee_inside' 등)
        this.targetId = null;         // 상호작용 중인 타겟 Entity ID (사냥감, 채집물 등)
        this.wanderAngle = Math.random() * Math.PI * 2; // 배회(Wander) 방향 (무작위)
        this.stateTimer = 0;          // 특정 상태(대기, 휴식 등)에 머문 시간 기록용
    }
}