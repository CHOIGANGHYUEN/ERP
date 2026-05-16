import GatherState from '../GatherState.js';
import { GlobalLogger } from '../../../../utils/Logger.js';

/**
 * 🆘 EmergencyWorkingState
 * 마을의 자원이 극도로 부족할 때 촌장이 직접 팔을 걷어붙이고 작업에 투입되는 상태입니다.
 * 일반 채집 상태와 유사하나, 촌장 전용 시각 피드백과 우선순위를 가집니다.
 */
export default class EmergencyWorkingState extends GatherState {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const civ = entity.components.get('Civilization');
        const inventory = entity.components.get('Inventory');
        
        if (!state || !civ) return 'idle';

        // 인벤토리가 꽉 찼으면 입고
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 타겟이 없으면 직업 매니저의 긴급 요청 확인
        if (!state.targetId) {
            const vs = this.system.engine.systemManager.villageSystem;
            const village = vs?.getVillage(civ.villageId);
            
            if (village && village.needs) {
                const urgency = village.needs.urgency;
                let targetType = 'wood';
                if (urgency.food > urgency.wood) targetType = 'berry';
                
                const targetManager = this.system.engine.systemManager.targetManager;
                targetManager.requestTarget(entityId, 'RESOURCE', { resourceType: targetType }, 'chief_emergency');
                state.isTargetRequested = true;
            }
            return null;
        }

        // 이동 및 작업 (부모 클래스 위임)
        const result = this.executeMovementAndGathering(entityId, entity, dt, 400);

        // 💦 [Visual] 솔선수범 중인 촌장의 외형에 땀방울 애니메이션 추가
        if (state.mode === 'chief_emergency' && Math.random() < 0.1) {
            const transform = entity.components.get('Transform');
            if (transform && this.system.eventBus) {
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x + (Math.random() - 0.5) * 10,
                    y: transform.y - 15 + (Math.random() - 0.5) * 5,
                    count: 1,
                    type: 'ZZZ', // 텍스트 파티클 재활용
                    text: '💧',
                    color: '#2196f3',
                    speed: 0.5
                });
            }
        }

        return result;
    }

    onGatherSuccess(entity, amount) {
        if (amount > 0) {
            GlobalLogger.info(`👑 [Chief] Emergency Gather: +${amount} resources.`);
            // 촌장이 직접 일할 때 주변 주민들에게 사기 진작 파티클
            const transform = entity.components.get('Transform');
            if (transform && this.system.eventBus) {
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: transform.x, y: transform.y - 15, count: 3, type: 'EFFECT', color: '#ffeb3b', speed: 2
                });
            }
        }
    }
}
