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

        builder.withTransform(x, y)
               .withVisual({ 
                   type: 'item', 
                   itemType: type, // renderer에서 이를 보고 적절한 아이콘/색상 결정
                   size: 8 + Math.min(amount * 0.5, 8) // 수량에 따라 약간 커짐
               })
               .addComponent('DroppedItem', new DroppedItem(type, amount, decayTime));

        const id = builder.id;

        // 🚀 [Optimization] 공간 해시에 즉시 등록
        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true);
        }

        return id;
    }

    /**
     * 특정 위치에 아이템을 드랍합니다. 주변에 같은 종류의 아이템이 있으면 병합합니다.
     */
    spawnDrop(x, y, itemType, amount) {
        // 1. 🔍 주변 아이템 검색 (병합 최적화)
        if (this.engine.spatialHash) {
            const nearbyIds = this.engine.spatialHash.query(x, y, 15); // 15px 반경
            for (const id of nearbyIds) {
                const ent = this.engine.entityManager.entities.get(id);
                const drop = ent?.components.get('DroppedItem');
                if (drop && drop.itemType === itemType) {
                    // 병합 성공!
                    drop.merge(amount);
                    
                    // 시각적 피드백 (크기 갱신 등은 렌더러가 담당하거나 비주얼 컴포넌트 수정)
                    const visual = ent.components.get('Visual');
                    if (visual) visual.size = 8 + Math.min(drop.amount * 0.5, 8);
                    
                    return id;
                }
            }
        }

        // 2. 🆕 병합할 대상이 없으면 새로 생성
        return this.create(itemType, x, y, { amount });
    }
}
