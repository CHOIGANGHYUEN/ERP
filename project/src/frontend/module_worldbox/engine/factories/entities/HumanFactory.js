import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import BaseStats from '../../components/stats/BaseStats.js';
import State from '../../components/behavior/State.js';
import Age from '../../components/stats/Age.js';
import Emotion from '../../components/stats/Emotion.js';
import Wealth from '../../components/resource/Wealth.js';

/**
 * 👤 HumanFactory
 * 인간 엔티티 조립을 전담하며, 복합적인 사회적 컴포넌트를 주입합니다.
 */
export default class HumanFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const config = this.engine.speciesConfig['human'] || {};
        
        const builder = new EntityBuilder(em);
        const id = builder.id;

        builder
            .withTransform(x, y)
            .withVisual({
                color: '#ffcc80',
                type: 'human',
                size: options.isBaby ? 0.7 : 1.0
            })
            .addComponent('Animal', { type: 'human', isBaby: options.isBaby || false, diet: 'omnivore' })
            .addComponent('BaseStats', new BaseStats({
                health: 100, maxHealth: 100,
                hunger: 70, maxHunger: 100,
                fatigue: 0, speed: config.moveSpeed || 1.2
            }))
            .addComponent('AIState', new State())
            .addComponent('Age', new Age({
                currentAge: options.isBaby ? 0 : 20 + Math.random() * 10,
                maxAge: 80 + Math.random() * 20
            }))
            .addComponent('Emotion', new Emotion())
            .addComponent('Wealth', new Wealth({ gold: options.initialGold || 10 }))
            .addComponent('Inventory', { items: {}, capacity: 50 })
            .addComponent('Civilization', { villageId: -1, techLevel: 0 })
            .addComponent('Builder', { buildSpeed: 5, isBuilding: false });

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, false);
        }

        return id;
    }
}
