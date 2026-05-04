import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import ResourceNode from '../../components/resource/ResourceNode.js';
import Health from '../../components/stats/Health.js';

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

        // 🏥 [Health Integration] 자원 체력 설정
        const config = this.engine.resourceConfig[type] || {};
        const maxHp = config.maxHp || 50;
        builder.addComponent('Health', new Health(maxHp));

        switch (type) {
            case 'meat':
                builder.withVisual({ type: 'meat', size: 10 })
                       .addComponent('Resource', new ResourceNode('meat', 50));
                break;
            case 'stone':
            case 'iron':
            case 'gold':
            case 'coal':
                builder.withVisual({ type: 'rock', color: config.color || '#757575', size: 12 })
                       .addComponent('Resource', new ResourceNode(type, 100));
                break;
            default:
                builder.withVisual({ type: type, size: 8 })
                       .addComponent('Resource', new ResourceNode(type, 100));
        }

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true);
        }

        return id;
    }
}
