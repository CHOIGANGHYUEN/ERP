import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🍽️ EatState
 * 식사 행동: 음식 타겟 앞에서 일정 시간 동안 허기를 회복하고 음식을 소모합니다.
 */
export default class EatState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const stats = entity.components.get('BaseStats');

        const target = this.system.entityManager.entities.get(state.targetId);

        // 1. 타겟 소멸 시 배회로 복귀
        if (!target) {
            state.targetId = null;
            state.timer = 0;
            return AnimalStates.IDLE;
        }

        // 2. 사거리 체크 (너무 멀어지면 다시 Forage로 돌아가서 추적)
        //    ※ HUNT 가 아닌 FORAGE 로 복귀 (인간은 동물 사냥보다 식물 채집 우선)
        const tPos = target.components.get('Transform');
        if (tPos) {
            const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
            if (distSq > 400) { // 반경 20px 이상이면 다시 추적
                // 인간이라면 FORAGE, 동물이라면 HUNT
                const animal = entity.components.get('Animal');
                const targetAnim = target.components.get('Animal');
                if (animal?.type === 'human' || !targetAnim) {
                    return AnimalStates.FORAGE;
                } else {
                    return AnimalStates.HUNT;
                }
            }
        }

        // 3. 포만감이 이미 충분하면 종료
        if (stats && stats.hunger >= stats.maxHunger * 0.95) {
            state.targetId = null;
            state.timer = 0;
            return AnimalStates.IDLE;
        }

        // 4. 실제 먹기 동작 (일정 시간 동안 점진적 허기 회복, 완료 시 음식 소모)
        if (stats) {
            const targetAnim = target.components.get('Animal');
            const targetRes = target.components.get('Resource');

            state.timer = (state.timer || 0) + dt;
            const eatDuration = 1.5; // 1.5초 식사 애니메이션

            // 매 프레임 허기 회복 (식사 중)
            const fillAmount = dt * 40; // 초당 40 회복
            stats.hunger = Math.min(stats.maxHunger, stats.hunger + fillAmount);
            stats.waste = Math.min(stats.maxWaste, (stats.waste || 0) + fillAmount * 0.5);

            if (state.timer >= eatDuration) {
                // 식사 완료: 음식 소모 처리
                if (targetAnim && (stats.diet === 'carnivore' || stats.diet === 'omnivore')) {
                    this.system.attackAndConsumeAnimal(entity, target);
                } else if (targetRes && targetRes.edible) {
                    this.system.consumePlant(entity, target);
                }
                
                state.timer = 0;
                state.targetId = null; 
                
                // 🔙 [Ecological Cycle] 이전 작업으로 복귀 (인터럽트 종료)
                if (state.popMode) {
                    state.popMode();
                } else {
                    state.mode = AnimalStates.IDLE;
                }
                return state.mode;
            }

            // 식물 소화 품질 기록
            if (targetRes && targetRes.edible) {
                const quality = (target.components.get('Visual')?.quality || 0.5);
                stats.digestionQuality = (stats.digestionQuality || 0.5) * 0.8 + quality * 0.2;
            }
        }

        return null;
    }
}
