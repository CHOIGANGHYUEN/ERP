import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import BaseStats from '../../components/stats/BaseStats.js';
import State from '../../components/behavior/State.js';
import Age from '../../components/stats/Age.js';
import TagBitmask from '../../components/stats/TagBitmask.js';
import GathererComponent from '../../components/resource/GathererComponent.js';

/**
 * 🐄 AnimalFactory
 * 동물(Tiger, Lion, Deer 등) 엔티티 조립을 전담합니다.
 */
export default class AnimalFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const config = this.engine.speciesConfig[type] || {};
        
        const builder = new EntityBuilder(em);
        const id = builder.id;

        // Tag 설정
        const diet = config.diet || 'herbivore';
        const tag = new TagBitmask();
        tag.add(TagBitmask.ANIMAL);
        if (diet === 'carnivore') {
            tag.add(TagBitmask.CARNIVORE);
        } else {
            tag.add(TagBitmask.HERBIVORE);
            tag.add(TagBitmask.PREY);
        }

        // 🚀 [Troubleshooting 2] 소환 위치 보정
        let spawnX = x;
        let spawnY = y;
        
        if (this.engine.spatialHash) {
            const nearbyBuildings = this.engine.spatialHash.query(x, y, 30).filter(id => {
                const ent = em.entities.get(id);
                return ent && ent.components.has('Building');
            });

            if (nearbyBuildings.length > 0) {
                for (let i = 0; i < 5; i++) {
                    const testX = x + (Math.random() - 0.5) * 40;
                    const testY = y + (Math.random() - 0.5) * 40;
                    const collisions = this.engine.spatialHash.query(testX, testY, 10).filter(id => {
                        const ent = em.entities.get(id);
                        return ent && ent.components.has('Building');
                    });
                    if (collisions.length === 0) {
                        spawnX = testX;
                        spawnY = testY;
                        break;
                    }
                }
            }
        }
        
        builder
            .withTransform(spawnX, spawnY)
            .withVisual({
                color: config.color || '#ffffff',
                type: type,
                size: options.isBaby ? 0.6 : 1.0
            })
            .addComponent('Animal', {
                type: type,
                isBaby: options.isBaby || false,
                diet: diet,
                herdId: -1
            })
            .addComponent('TagBitmask', tag)
            .addComponent('BaseStats', new BaseStats({
                diet: diet,
                health: config.maxHealth || 100,
                maxHealth: config.maxHealth || 100,
                strength: config.attackDamage || 10,
                hunger: options.isBaby ? 80 : (50 + Math.random() * 30),
                maxHunger: 100,
                fatigue: Math.random() * 20,
                speed: config.moveSpeed || 40 // pixels per second
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
            }))
            .addComponent('GathererComponent', new GathererComponent({ gatherSpeed: type === 'bee' ? 20.0 : 10.0 }));

        // 공간 해시 등록
        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, false);
        }

        return id;
    }
}
