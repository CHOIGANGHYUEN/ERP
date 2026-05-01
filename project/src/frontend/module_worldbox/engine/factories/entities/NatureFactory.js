import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';

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
        } else if (type.includes('grass') || type.includes('flower')) {
            this._setupPlant(builder, type, quality);
        } else {
            // 기본 환경 요소
            builder.withVisual({ type: type, color: '#2e7d32' });
        }

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true); // Static
        }

        return id;
    }

    _setupTree(builder, type, quality, options) {
        builder.withVisual({
            type: 'tree',
            size: 15 + (quality * 10),
            quality: quality,
            subtype: options.subtype || 'normal'
        }).addComponent('Resource', {
            type: 'wood',
            value: Math.floor(quality * 100),
            isTree: true
        });
    }

    _setupPlant(builder, type, quality) {
        builder.withVisual({
            type: type.includes('grass') ? 'grass' : 'flower',
            quality: quality,
            color: type.includes('grass') ? '#4caf50' : '#ff4081'
        }).addComponent('Resource', {
            type: 'food',
            value: Math.floor(quality * 20),
            edible: true
        });
    }
}
