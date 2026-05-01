import State from './State.js';
import Pathfinder from '../../utils/Pathfinder.js';

export default class DepositState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const civ = entity.components.get('Civilization');

        // 인벤토리가 비어있으면 idle 상태로
        if (!inventory || inventory.getTotal() === 0) {
            state.targetId = null;
            return 'idle';
        }

        const em = this.system.entityManager;

        // 1. 창고 찾기
        if (!state.targetId) {
            let nearestStorageId = null;
            let minDistSq = Infinity;
            const villageId = civ ? civ.villageId : -1;

            // 건물들 중에서 창고 찾기
            for (const id of em.buildingIds) {
                const targetEntity = em.entities.get(id);
                if (!targetEntity) continue;
                
                const building = targetEntity.components.get('Building');
                const structure = targetEntity.components.get('Structure');
                const storage = targetEntity.components.get('Storage');

                // 완성된 창고이고, 같은 마을(또는 소속 없음)일 때
                if (building && structure && storage && structure.isComplete && (villageId === -1 || building.villageId === villageId)) {
                    const tPos = targetEntity.components.get('Transform');
                    if (tPos) {
                        const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
                        if (distSq < minDistSq) {
                            minDistSq = distSq;
                            nearestStorageId = id;
                        }
                    }
                }
            }

            if (nearestStorageId) {
                state.targetId = nearestStorageId;
            } else {
                // 창고를 못 찾으면 일단 배회
                return 'wander';
            }
        }

        const target = em.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return null;
        }

        const tPos = target.components.get('Transform');
        const storage = target.components.get('Storage');
        
        if (!tPos || !storage) {
            state.targetId = null;
            return null;
        }

        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 2. 창고에 도달
        if (distSq <= 1600) { // 반경 40px
            transform.vx = 0;
            transform.vy = 0;

            // 모든 아이템 옮기기
            for (const type in inventory.items) {
                const amount = inventory.items[type];
                if (amount > 0) {
                    const added = storage.addItem(type, amount);
                    if (added > 0) {
                        inventory.consume(type, added);
                        
                        // 시각적 피드백 (아이템이 창고로 들어가는 파티클)
                        const color = type === 'wood' ? '#795548' : (type === 'food' ? '#4caf50' : '#9e9e9e');
                        this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x, y: transform.y - 10, count: 3, type: 'EFFECT', color: color, speed: 2
                        });
                    }
                }
            }

            state.targetId = null;
            return 'idle';
        } else {
            // 창고로 이동 (경로 탐색 적용)
            Pathfinder.followPath(transform, state, tPos, 55, em);
        }

        return null;
    }
}
