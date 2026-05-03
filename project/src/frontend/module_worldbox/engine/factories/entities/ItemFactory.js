import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import DroppedItem from '../../components/resource/DroppedItem.js';

/**
 * 📦 ItemFactory
 * 바닥에 드랍되는 아이템 엔티티의 생성을 전담합니다.
 */
export default class ItemFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const builder = new EntityBuilder(em);
        const amount = options.amount || 1;

        // 아이템의 수명 설정 (기본 300초 = 5분)
        const decayTime = options.decayTime || 300;

        // 🎨 [시각적 힌트 추가] 아이템 타입에 따른 고유 색상 및 이모지 설정
        let color = '#ffffff';
        let icon = '📦';
        if (type === 'wood' || type.includes('tree')) { color = '#8d6e63'; icon = '🪵'; }
        else if (type === 'stone' || type.includes('rock')) { color = '#9e9e9e'; icon = '🪨'; }
        else if (type === 'meat') { color = '#ff5252'; icon = '🥩'; }
        else if (type === 'fruit' || type === 'berry') { color = '#e91e63'; icon = '🍎'; }
        else if (type === 'grass' || type === 'flower' || type === 'shrub' || type === 'plant') { color = '#4caf50'; icon = '🌿'; }
        else if (type === 'food' || type === 'bread') { color = '#8bc34a'; icon = '🍖'; }
        else if (type === 'gold' || type.includes('gold')) { color = '#fbc02d'; icon = '🟡'; }
        else if (type === 'coal') { color = '#212121'; icon = '⬛'; }
        else if (type === 'iron_ore' || type.includes('iron')) { color = '#757575'; icon = '⛓️'; }

        builder.withTransform(x, y)
            .withVisual({
                type: 'item',
                itemType: type, // renderer에서 이를 보고 적절한 아이콘/색상 결정
                color: color,
                icon: icon,
                size: 4 + Math.min(amount * 0.2, 4) // [Aesthetic] 훨씬 작고 아기자기하게 (4~8px 사이)
            })
            .addComponent('DroppedItem', new DroppedItem(type, amount, decayTime));

        const id = builder.id;

        // 🚀 [Optimization] 공간 해시에 즉시 등록
        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true);
        }

        return id;
    }

    spawnDrop(x, y, itemType, amount) {
        // 🚀 [Optimization] 드랍 시 약간의 랜덤 위치 오프셋 추가 (겹침 방지 강화)
        const jX = x + (Math.random() - 0.5) * 12;
        const jY = y + (Math.random() - 0.5) * 12;

        const MAX_STACK = 30; // 📦 [User Request] 한 곳에 너무 몰리지 않도록 최대 스택 제한

        // 1. 🔍 주변 아이템 검색 (병합 최적화)
        if (this.engine.spatialHash) {
            const nearbyIds = this.engine.spatialHash.query(jX, jY, 8); // 탐색 반경 축소 (20 -> 8) 하여 과도한 뭉침 방지
            for (const id of nearbyIds) {
                const ent = this.engine.entityManager.entities.get(id);
                const drop = ent?.components.get('DroppedItem');

                // 같은 타입이고, 아직 최대 스택에 도달하지 않은 아이템만 병합
                if (drop && drop.itemType === itemType && drop.amount < MAX_STACK) {
                    // 병합 성공!
                    drop.merge(amount);

                    const visual = ent.components.get('Visual');
                    if (visual) visual.size = 4 + Math.min(drop.amount * 0.2, 4);

                    return id;
                }
            }
        }

        // 2. 🆕 병합할 대상이 없으면 새로 생성 (편차가 적용된 위치에)
        return this.create(itemType, jX, jY, { amount });
    }
}
