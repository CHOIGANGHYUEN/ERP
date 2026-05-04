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
        const lowerType = type.toLowerCase();

        // 🎯 [Priority Fix] 식물 및 식품 계열 판정을 목재보다 먼저 수행하여 오판 방지
        if (lowerType.includes('grass') || lowerType.includes('flower') || lowerType.includes('plant') || lowerType.includes('pasture') || lowerType.includes('leaf') || lowerType.includes('herb') || lowerType.includes('shrub') || lowerType.includes('bush') || lowerType.includes('fiber') || lowerType.includes('reed') || lowerType.includes('vine')) { color = '#4caf50'; icon = '🌿'; }
        else if (lowerType.includes('fruit') || lowerType.includes('berry') || lowerType.includes('apple')) { color = '#e91e63'; icon = '🍎'; }
        else if (lowerType.includes('meat')) { color = '#ff5252'; icon = '🥩'; }
        else if (lowerType.includes('food') || lowerType.includes('bread')) { color = '#8bc34a'; icon = '🍖'; }
        else if (lowerType.includes('wood') || lowerType.includes('tree') || lowerType.includes('log')) { color = '#8d6e63'; icon = '🪵'; }
        else if (lowerType.includes('stone') || lowerType.includes('rock') || lowerType.includes('ore') || lowerType.includes('mineral')) { color = '#9e9e9e'; icon = '🪨'; }
        else if (lowerType.includes('gold')) { color = '#fbc02d'; icon = '🟡'; }
        else if (lowerType.includes('coal')) { color = '#212121'; icon = '⬛'; }
        else if (lowerType.includes('iron')) { color = '#757575'; icon = '⛓️'; }
        else { color = '#ffffff'; icon = '📦'; } // 기본값

        // 🔍 [Data Connection] 설정 파일에서 실제 이름 가져오기 (1회성 처리)
        const config = this.engine.resourceConfig[type];
        let displayName = config?.name;
        
        // 대소문자 무시 검색 (방어적 설계)
        if (!displayName) {
            const matchingKey = Object.keys(this.engine.resourceConfig).find(k => k.toLowerCase() === lowerType);
            if (matchingKey) displayName = this.engine.resourceConfig[matchingKey].name;
        }

        builder.withTransform(x, y)
            .withVisual({
                type: 'item',
                itemType: type,
                color: color,
                icon: icon,
                size: 2 + Math.min(amount * 0.05, 2)
            })
            .addComponent('DroppedItem', new DroppedItem(type, amount, decayTime, displayName));

        const id = Number(builder.id);
        if (isNaN(id)) {
            console.error("ItemFactory: Generated ID is NaN!", builder.id);
            return null;
        }

        // 🚀 [Optimization] 공간 해시에 즉시 등록
        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true);
        }

        return Number(id);
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
                    if (visual) visual.size = 2 + Math.min(drop.amount * 0.1, 2);

                    return id;
                }
            }
        }

        // 2. 🆕 병합할 대상이 없으면 새로 생성 (편차가 적용된 위치에)
        return this.create(itemType, jX, jY, { amount });
    }
}
