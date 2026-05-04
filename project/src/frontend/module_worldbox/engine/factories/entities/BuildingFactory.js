import IEntityFactory from '../core/IEntityFactory.js';
import EntityBuilder from '../core/EntityBuilder.js';
import Storage from '../../components/resource/Storage.js';
import Housing from '../../components/civilization/Housing.js';
import Door from '../../components/civilization/Door.js';
import Health from '../../components/stats/Health.js';

/**
 * 🏠 BuildingFactory
 * 창고, 농장, 주택 등 건축물 엔티티의 조립을 전담합니다.
 */
export default class BuildingFactory extends IEntityFactory {
    create(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const builder = new EntityBuilder(em);
        const id = Number(builder.id);
        if (isNaN(id)) {
            console.error("BuildingFactory: Generated ID is NaN!", builder.id);
            return null;
        }

        const buildingConfigs = this.engine.buildingsConfig || {};
        const config = buildingConfigs[type] || { maxHp: 500, maxProgress: 100, width: 40, height: 40 };

        builder
            .withTransform(x, y)
            .withVisual({
                type: 'building',
                subtype: type,
                size: options.size || (config.width || 40),
                color: options.color || (config.color || '#8d6e63'),
                alpha: options.isBlueprint ? 0.8 : 1.0
            })
            .addComponent('Building', {
                type: type,
                level: 1,
                health: config.maxHp,
                maxHealth: config.maxHp,
                villageId: options.villageId || -1
            })
            .addComponent('Structure', {
                type: type,
                progress: options.isBlueprint ? 0 : config.maxProgress,
                maxProgress: config.maxProgress,
                isComplete: !options.isBlueprint,
                isBlueprint: options.isBlueprint || false
            })
            .addComponent('Health', new Health(config.maxHp || 500));

        // 🚪 울타리 문(fence_gate)인 경우 Door 컴포넌트 추가
        if (type === 'fence_gate') {
            builder.addComponent('Door', { isOpen: false });
        }

        // 타입별 특수 기능 조립
        if (type === 'storage' || type === 'warehouse') {
            builder.addComponent('Storage', new Storage({ capacity: 2000 }));
        } else if (type === 'house' || type === 'tent') {
            builder.addComponent('Housing', new Housing({ capacity: options.capacity || 4 }));
        } else if (type === 'farm') {
            builder.addComponent('Storage', new Storage({ capacity: 500 }))
                   .addComponent('Farm', { 
                       cropType: 'wheat', 
                       growthRate: 0.05,
                       maxCrops: 10,
                       currentCrops: 0,
                       lastHarvest: 0
                   });
        } else if (type === 'fence' || type === 'wall') {
            // 울타리는 별도의 기능은 없으나 충돌 레이어에서 장애물로 작동함
            builder.addComponent('Obstacle', { blocksMovement: true });
        } else if (type === 'fence_gate') {
            builder.addComponent('Door', { isOpen: false });
        } else if (type === 'pasture') {
            // 🐄 목장: 가축을 수용하는 공간
            builder.addComponent('Storage', new Storage({ capacity: 100 }))
                   .addComponent('LivestockHousing', { capacity: 5, animals: [] });
        } else if (type === 'well') {
            builder.addComponent('Storage', new Storage({ capacity: 100 }))
                   .addComponent('BuffSource', { type: 'happiness', radius: 150 });
        } else if (type === 'blacksmith') {
            builder.addComponent('Storage', new Storage({ capacity: 500 }))
                   .addComponent('Production', { type: 'tools', efficiency: 1.0 });
        } else if (type === 'temple') {
            builder.addComponent('BuffSource', { type: 'authority', radius: 300 });
        } else if (type === 'watchtower') {
            // 🏹 망루: 방어 및 시야 확보
            builder.addComponent('Sensor', { range: 300, targetTypes: ['predator', 'enemy'] });
        } else if (type === 'bonfire' || type === 'camp') {
            builder.withVisual({ 
                type: 'building', 
                subtype: type, 
                size: 25, 
                color: '#ff9800',
                alpha: options.isBlueprint ? 0.8 : 1.0 // 청사진 알파 상향 (0.6 -> 0.8)
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
