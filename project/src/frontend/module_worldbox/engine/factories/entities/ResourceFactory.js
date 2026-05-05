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

        // 🚀 [Bug Fix] 하늘에서 떨어지는 효과 처리
        let startY = y;
        if (options.isFalling) {
            startY = y - 150;
            em.bufferManager.vy[id] = 200; // 떨어지는 속도
            em.bufferManager.isFalling[id] = 1;
            builder.addComponent('TargetY', { y }); // 목표 바닥 좌표 저장
        }

        builder.withTransform(x, startY);

        // 🏥 [Health Integration] 자원 체력 설정
        const config = this.engine.resourceConfig[type] || {};
        const maxHp = config.maxHp || 50;
        builder.addComponent('Health', new Health(maxHp, id, em.bufferManager));

        switch (type) {
            case 'meat':
                builder.withVisual({ type: 'meat', size: 10 })
                    .addComponent('Resource', new ResourceNode('meat', 50, 'resource', id, em.bufferManager));
                break;
            case 'stone':
            case 'iron':
            case 'gold':
            case 'coal':
                builder.withVisual({ type: 'rock', color: config.color || '#757575', size: 12 })
                    .addComponent('Resource', new ResourceNode(type, 100, 'resource', id, em.bufferManager));
                break;
            default:
                builder.withVisual({ type: type, size: 8 })
                    .addComponent('Resource', new ResourceNode(type, 100, 'resource', id, em.bufferManager));
        }

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, startY, !options.isFalling);
        }

        return id;
    }
}
