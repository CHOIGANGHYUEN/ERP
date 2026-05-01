import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';

/**
 * 🔨 ToolFactory
 * 도구, 무기 등 인간이 사용하는 아이템의 조립을 전담합니다.
 */
export default class ToolFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const builder = new EntityBuilder(em);
        const id = builder.id;

        builder
            .withTransform(x, y)
            .withVisual({
                type: 'tool',
                subtype: type,
                size: 8,
                color: '#9e9e9e'
            })
            .addComponent('Item', {
                type: type,
                ownerId: options.ownerId || -1,
                durability: 100,
                power: options.power || 10
            });

        return id;
    }
}
