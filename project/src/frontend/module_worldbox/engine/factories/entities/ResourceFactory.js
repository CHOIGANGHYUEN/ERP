import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import ResourceNode from '../../components/resource/ResourceNode.js';

/**
 * 💎 ResourceFactory
 * 광물, 식량 자원, 전리품 등 비생명 객체의 조립을 전담합니다.
 */
export default class ResourceFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const builder = new EntityBuilder(em);
        const id = builder.id;
        const quality = options.quality || 1.0;

        builder.withTransform(x, y);

        switch (type) {
            case 'meat':
                builder.withVisual({ type: 'meat', size: 10 })
                       .addComponent('Resource', new ResourceNode('meat', 50));
                break;
            case 'rock':
            case 'ore':
                builder.withVisual({ type: 'rock', color: '#757575', size: 12 })
                       .addComponent('Resource', new ResourceNode('stone', 100));
                break;
            case 'poop':
                builder.withVisual({ type: 'poop', size: 6 })
                       .addComponent('Resource', new ResourceNode('poop', 100));
                break;
            default:
                builder.withVisual({ type: type, size: 8 });
        }

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true);
        }

        return id;
    }
}
