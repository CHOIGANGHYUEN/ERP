import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import Storage from '../../components/resource/Storage.js';
import Housing from '../../components/civilization/Housing.js';

/**
 * 🏠 BuildingFactory
 * 창고, 농장, 주택 등 건축물 엔티티의 조립을 전담합니다.
 */
export default class BuildingFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const builder = new EntityBuilder(em);
        const id = builder.id;

        builder
            .withTransform(x, y)
            .withVisual({
                type: 'building',
                subtype: type,
                size: options.size || 40,
                color: options.color || '#8d6e63',
                alpha: options.isBlueprint ? 0.3 : 1.0
            })
            .addComponent('Building', {
                type: type,
                level: 1,
                health: 500,
                maxHealth: 500,
                villageId: options.villageId || -1
            })
            .addComponent('Structure', {
                type: type,
                progress: options.isBlueprint ? 0 : 100,
                maxProgress: 100,
                isComplete: !options.isBlueprint,
                isBlueprint: options.isBlueprint || false
            });

        // 타입별 특수 기능 조립
        if (type === 'storage' || type === 'warehouse') {
            builder.addComponent('Storage', new Storage({ capacity: 2000 }));
        } else if (type === 'house' || type === 'tent') {
            builder.addComponent('Housing', new Housing({ capacity: options.capacity || 4 }));
        } else if (type === 'farm') {
            builder.addComponent('Storage', new Storage({ capacity: 500 }))
                   .addComponent('Farm', { cropType: 'wheat', growthRate: 0.1 });
        } else if (type === 'bonfire') {
            builder.withVisual({ 
                type: 'building', 
                subtype: 'bonfire', 
                size: 25, 
                color: '#ff9800',
                alpha: options.isBlueprint ? 0.3 : 1.0
            }).addComponent('LightSource', { intensity: 1.0, radius: 100 });
        }

        if (this.engine.spatialHash) {
            this.engine.spatialHash.insert(id, x, y, true);
        }

        // 🌱 건물이 설치된 자리는 비옥도를 0으로 만들어 자원(나무 등)이 생성되지 않도록 함
        if (this.engine.terrainGen) {
            const size = options.size || 40;
            const radius = Math.floor(size / 2);
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    const idx = this.engine.terrainGen.getIndex(x + dx, y + dy);
                    if (this.engine.terrainGen.isValidIndex(idx)) {
                        this.engine.terrainGen.fertilityBuffer[idx] = 0;
                    }
                }
            }
            this.engine.eventBus.emit('CACHE_PIXEL_UPDATE', { x: Math.floor(x), y: Math.floor(y), reason: 'building_placed' });
        }

        return id;
    }
}
