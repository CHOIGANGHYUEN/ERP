
import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import BaseStats from '../../components/stats/BaseStats.js';
import State from '../../components/behavior/State.js';
import Age from '../../components/stats/Age.js';
import Builder from '../../components/civilization/Builder.js';
import Inventory from '../../components/resource/Inventory.js';

/**
 * 👨‍👩‍👧‍👦 HumanFactory
 * 인류 엔티티의 정교한 조립을 담당합니다.
 * 성별, 전문성, 문명 관련 컴포넌트를 통합 관리합니다.
 */
export default class HumanFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const config = this.engine.speciesConfig['human'] || {};
        
        const builder = new EntityBuilder(em);
        const id = builder.id;

        // 🧬 성별 결정 (남성: male, 여성: female)
        const gender = options.gender || (Math.random() > 0.5 ? 'male' : 'female');

        builder
            .withTransform(x, y)
            .withVisual({
                type: 'human',
                gender: gender,
                color: gender === 'male' ? '#448aff' : '#ff4081', // 남성: 시안/블루, 여성: 핑크
                size: options.isBaby ? 0.6 : 1.0,
                isBaby: options.isBaby || false
            })
            .addComponent('Animal', {
                type: 'human',
                isBaby: options.isBaby || false,
                diet: 'omnivore',
                gender: gender
            })
            .addComponent('BaseStats', new BaseStats({
                health: config.maxHealth || 120,
                maxHealth: config.maxHealth || 120,
                hunger: options.isBaby ? 80 : (60 + Math.random() * 20),
                maxHunger: 100,
                fatigue: Math.random() * 10,
                speed: config.moveSpeed || 1.1,
                strength: 15
            }))
            .addComponent('Metabolism', {
                digestionSpeed: config.digestionSpeed || 0.1,
                stomach: 50, // 초기 위장 상태 (BaseStats와 연동됨)
                maxStomach: 100,
                storedFertility: 0,
                isPooping: false
            })
            .addComponent('AIState', new State())
            .addComponent('Age', new Age({
                currentAge: options.isBaby ? 0 : 18 + Math.random() * 5,
                maxAge: config.maxLifespan || (60 + Math.random() * 20)
            }))
            .addComponent('Builder', new Builder())
            .addComponent('Inventory', new Inventory(20));

        // 문명 소속 설정 (기본값 -1)
        builder.addComponent('Civilization', { villageId: options.villageId || -1 });

        // 공간 해시 등록
        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, false);
        }

        return id;
    }
}
