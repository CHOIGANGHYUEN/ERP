import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import ResourceNode from '../../components/resource/ResourceNode.js';
import Health from '../../components/stats/Health.js';

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

        if (type.includes('tree') || type === 'oak' || type === 'mahogany') {
            this._setupTree(builder, type, quality, options);
        } else if (type.includes('grass') || type.includes('flower') || type.includes('berry') || type.includes('shrub') || type.includes('herb') || type.includes('moss') || type.includes('kelp') || type.includes('seaweed') || ['lotus', 'reed', 'vine', 'cactus', 'weeds', 'mushroom'].includes(type)) {
            this._setupPlant(builder, type, quality);
        } else {
            builder.withVisual({ type: type, color: '#2e7d32' });
            // 일반 환경 요소도 최소한의 자원 컴포넌트는 가짐 (오류 방지)
            builder.addComponent('Resource', new ResourceNode(type, 10));
        }

        // 🏥 [Health Integration] 모든 자연 개체에 체력 부여
        const config = this.engine.resourceConfig?.[type] || {};
        const maxHp = config.maxHp || 50;
        builder.addComponent('Health', new Health(maxHp));

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true); // Static
        }

        return id;
    }

    _setupTree(builder, type, quality, options) {
        // 🌱 [생태계 복원] 명시적으로 성목 스폰을 요청하지 않은 이상 모든 나무는 묘목(작은 크기)부터 시작합니다.
        const isGrown = options.isGrown === true;
        const targetSize = 15 + (quality * 10);
        const targetAmount = Math.floor(quality * 100) + 50;

        const initialSize = isGrown ? targetSize : 5;
        const initialAmount = isGrown ? targetAmount : 5;

        const visual = {
            type: 'tree',
            size: targetSize, // 🌲 [Stability] 타이머 기반 생장 대신 즉시 성목으로 생성
            quality: quality,
            subtype: options.subtype || 'normal'
        };

        const resource = new ResourceNode(type, targetAmount);

        builder.withVisual(visual).addComponent('Resource', resource);
    }

    _setupPlant(builder, type, quality) {
        const amount = Math.floor(quality * 20) + 10;
        const isGrassLike = type.includes('grass') || type.includes('pasture') || type.includes('reed') || type.includes('vine') || type.includes('weeds') || type.includes('moss');
        const isBerryLike = type.includes('berry') || type.includes('fruit') || type === 'cactus';

        builder.withVisual({
            type: isGrassLike ? 'grass' : (isBerryLike ? 'berry' : 'flower'),
            quality: quality,
            color: isGrassLike ? '#4caf50' : (isBerryLike ? '#e91e63' : '#ff4081')
        }).addComponent('Resource', new ResourceNode(type, amount));
    }
}
