import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import Fence from '../../components/civilization/Fence.js';
import Health from '../../components/stats/Health.js';
import Structure from '../../components/civilization/Structure.js';
import { GlobalLogger } from '../../utils/Logger.js';

/**
 * 🧱 FenceFactory
 * 울타리 엔티티의 조립과 초기화를 담당합니다.
 */
export default class FenceFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const builder = new EntityBuilder(em);
        const id = builder.id;

        const material = options.material || 'wood';
        const isBlueprint = options.isBlueprint || false;
        
        // 재질별 체력 설정
        let maxHp = 100;
        if (material === 'stone') maxHp = 300;
        if (material === 'iron') maxHp = 800;

        const structureComp = new Structure('fence', 20);
        builder
            .withTransform(x, y)
            .withVisual({
                type: 'fence',
                material: material,
                size: 1.0,
                color: material === 'wood' ? '#795548' : (material === 'stone' ? '#9e9e9e' : '#455a64'),
                isBlueprint: isBlueprint
            })
            .addComponent('Fence', new Fence({
                material: material,
                villageId: options.villageId || -1,
                isBlueprint: isBlueprint,
                buildProgress: isBlueprint ? 0.0 : 1.0
            }))
            .addComponent('Structure', structureComp)
            .addComponent('Health', new Health(maxHp));

        if (isBlueprint) {
            structureComp.progress = 0;
            structureComp.isBlueprint = true;
            structureComp.isComplete = false;
        } else {
            structureComp.progress = 20;
            structureComp.isComplete = true;
            structureComp.isBlueprint = false;
        }

        // 🏗️ 장애물 등록 (청사진이 아닐 때만)
        if (!isBlueprint && this.engine.spatialHash) {
            // 울타리는 고정 장애물이므로 static 레이어에 등록하거나 
            // 기존 spatialHash의 특징을 활용 (여기선 일반 등록)
            this.engine.spatialHash.insert(id, x, y, true);
        }

        return id;
    }
}
