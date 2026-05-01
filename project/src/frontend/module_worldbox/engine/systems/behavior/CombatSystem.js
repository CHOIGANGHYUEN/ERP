import System from '../../core/System.js';
import { AnimalStates } from '../../components/behavior/State.js';

export default class CombatSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);

        // 이벤트 버스를 구독하여 타 시스템과의 강결합 방지
        this.eventBus.on('COMBAT_ATTACK', this.handleAttack.bind(this));
    }

    handleAttack({ attacker, defender }) {
        if (!attacker || !defender) return;

        const attackerStats = attacker.components.get('BaseStats');
        const defenderStats = defender.components.get('BaseStats');
        const defenderState = defender.components.get('AIState');

        if (attackerStats && defenderStats) {
            const damage = attackerStats.strength || 10;
            defenderStats.takeDamage(damage);

            if (defenderStats.health <= 0 && defenderState) {
                defenderState.mode = AnimalStates.DIE;
            }
        } else if (defenderState) {
            // 스탯이 없는 일반 객체는 즉사 처리 (기존 로직 유지)
            defenderState.mode = AnimalStates.DIE;
        }
    }

    update(dt, time) {
        // 상태 이상(독, 화상 등)에 의한 지속 데미지 로직이 필요할 때 활용 가능
    }
}