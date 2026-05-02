import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import ResourceNode from '../../components/resource/ResourceNode.js';

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
            builder.addComponent('Resource', new ResourceNode(type, 10));
        }

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
            size: initialSize,
            quality: quality,
            subtype: options.subtype || 'normal'
        };

        const resource = new ResourceNode(type.includes('tree') ? type : 'tree', initialAmount);

        builder.withVisual(visual).addComponent('Resource', resource);

        if (!isGrown) {
            // 묘목이 성목으로 자라나는 점진적 생장 로직
            const growthInterval = setInterval(() => {
                const em = this.engine.entityManager;
                // 엔티티가 파괴(벌목)되면 생장 중지
                if (!em.entities.has(builder.id)) {
                    clearInterval(growthInterval);
                    return;
                }

                visual.size += 1.0;
                resource.value += 10;

                // 목표치에 도달하면 완전한 성목으로 판정 후 타이머 종료
                if (visual.size >= targetSize) {
                    visual.size = targetSize;
                    resource.value = targetAmount;
                    clearInterval(growthInterval);
                }
            }, 6000); // 6초마다 생장
        }
    }

    _setupPlant(builder, type, quality) {
        const amount = Math.floor(quality * 20) + 10;
        builder.withVisual({
            type: type.includes('grass') ? 'grass' : (type === 'berry' ? 'berry' : 'flower'),
            quality: quality,
            color: type.includes('grass') ? '#4caf50' : (type === 'berry' ? '#e91e63' : '#ff4081')
        }).addComponent('Resource', new ResourceNode(type, amount));
    }
}
