import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import BaseStats from '../../components/stats/BaseStats.js';
import State from '../../components/behavior/State.js';
import Age from '../../components/stats/Age.js';

/**
 * 🐄 AnimalFactory
 * 동물(Bee, Cow, Sheep 등) 엔티티 조립을 전담합니다.
 */
export default class AnimalFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const config = this.engine.speciesConfig[type] || {};
        
        const builder = new EntityBuilder(em);
        const id = builder.id;

        builder
            .withTransform(x, y)
            .withVisual({
                color: config.color || '#ffffff',
                type: type,
                size: options.isBaby ? 0.6 : 1.0
            })
            .addComponent('Animal', {
                type: type,
                isBaby: options.isBaby || false,
                diet: config.diet || 'herbivore',
                herdId: -1
            })
            .addComponent('BaseStats', new BaseStats({
                diet: config.diet || 'herbivore',
                health: config.maxHealth || 100,
                maxHealth: config.maxHealth || 100,
                hunger: options.isBaby ? 80 : (50 + Math.random() * 30),
                maxHunger: 100,
                fatigue: Math.random() * 20,
                speed: config.moveSpeed || 1.0
            }))
            .addComponent('Metabolism', {
                digestionSpeed: config.digestionSpeed || 0.15,
                storedFertility: 0,
                isPooping: false
            })
            .addComponent('AIState', new State())
            .addComponent('Age', new Age({
                currentAge: options.isBaby ? 0 : 5 + Math.random() * 10,
                maxAge: config.maxLifespan || (20 + Math.random() * 10)
            }));

        // 공간 해시 등록
        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, false);
        }

        return id;
    }
}
