import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import Resource from '../../components/resource/Resource.js';

/**
 * 🌲 NatureFactory
 * 식물, 나무 등 지형 식생 객체의 조립을 전담합니다.
 */
export default class NatureFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const builder = new EntityBuilder(em);
        const id = builder.id;
        const quality = options.quality || 0.5;

        builder.withTransform(x, y);

        if (type.includes('tree')) {
            this._setupTree(builder, type, quality, options);
        } else if (type.includes('grass') || type.includes('flower') || type === 'berry' || type === 'shrub') {
            this._setupPlant(builder, type, quality);
        } else {
            builder.withVisual({ type: type, color: '#2e7d32' });
            // 일반 환경 요소도 최소한의 자원 컴포넌트는 가짐 (오류 방지)
            builder.addComponent('Resource', new Resource(type, 10));
        }

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true); // Static
        }

        return id;
    }

    _setupTree(builder, type, quality, options) {
        const amount = Math.floor(quality * 100) + 50;
        builder.withVisual({
            type: 'tree',
            size: 15 + (quality * 10),
            quality: quality,
            subtype: options.subtype || 'normal'
        }).addComponent('Resource', new Resource(type.includes('tree') ? type : 'tree', amount));
    }

    _setupPlant(builder, type, quality) {
        const amount = Math.floor(quality * 20) + 10;
        builder.withVisual({
            type: type.includes('grass') ? 'grass' : (type === 'berry' ? 'berry' : 'flower'),
            quality: quality,
            color: type.includes('grass') ? '#4caf50' : (type === 'berry' ? '#e91e63' : '#ff4081')
        }).addComponent('Resource', new Resource(type, amount));
    }
}
