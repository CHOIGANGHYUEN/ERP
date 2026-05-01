import System from '../../core/System.js';

/**
 * 🏘️ VillageSystem
 * 마을의 생성, 인구 관리, 건설 우선순위 및 자원 분배를 총괄합니다.
 */
export default class VillageSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.villages = new Map();
        this.nextVillageId = 1;

        // 📡 Listen for events
        this.eventBus.on('CREATE_VILLAGE', (payload) => this.createVillage(payload));
    }

    update(dt, time) {
        // 마을 발전 상태 체크 및 건설 계획 수립
        for (const village of this.villages.values()) {
            this._updateVillagePlanning(village);
        }

        // 시조 인류 체크: 마을이 하나도 없는데 인간이 있다면 마을 생성 시도
        if (this.villages.size === 0) {
            this._checkFirstFounder();
        }
    }

    createVillage({ founderId, x, y }) {
        const id = this.nextVillageId++;
        const village = {
            id,
            name: `Village ${id}`,
            founderId,
            centerX: x,
            centerY: y,
            members: new Set([founderId]),
            buildings: new Set(),
            resources: { wood: 0, food: 0, stone: 0 },
            plan: ['bonfire', 'storage'], // 🏗️ 건설 우선순위
            currentTask: null
        };

        this.villages.set(id, village);

        // 창립자에게 마을 정보 주입
        const founder = this.entityManager.entities.get(founderId);
        if (founder) {
            const civ = founder.components.get('Civilization');
            if (civ) civ.villageId = id;
        }

        console.log(`🏘️ Village founded by entity ${founderId} at (${x}, ${y})`);
        this.eventBus.emit('VILLAGE_FOUNDED', { villageId: id, x, y });
        
        return id;
    }

    _checkFirstFounder() {
        const em = this.entityManager;
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const animal = entity.components.get('Animal');
            if (animal && animal.type === 'human') {
                const transform = entity.components.get('Transform');
                if (transform) {
                    this.createVillage({ founderId: id, x: transform.x, y: transform.y });
                    break; 
                }
            }
        }
    }

    _updateVillagePlanning(village) {
        // 건설 계획 실행 로직
        if (village.plan.length > 0) {
            const nextBuildingType = village.plan[0];
            
            // 🔍 현재 마을 소유의 특정 타입 건물이 지어지고 있거나 완성되었는지 확인
            const hasBuilding = Array.from(village.buildings).some(bId => {
                const b = this.entityManager.entities.get(bId);
                const buildingComp = b?.components.get('Building');
                return b && buildingComp && buildingComp.type === nextBuildingType && buildingComp.villageId === village.id;
            });

            if (!hasBuilding) {
                // 🌍 [Stability] 지형 검사 후 청사진 생성
                let spawnX, spawnY;
                let foundSpot = false;
                let attempts = 0;

                while (!foundSpot && attempts < 10) {
                    spawnX = village.centerX + (Math.random() - 0.5) * 100;
                    spawnY = village.centerY + (Math.random() - 0.5) * 100;
                    
                    if (this.engine.terrainGen && this.engine.terrainGen.isLandAt(spawnX, spawnY)) {
                        foundSpot = true;
                    }
                    attempts++;
                }

                if (foundSpot) {
                    const blueprintId = this.engine.factoryProvider.spawn('building', nextBuildingType, spawnX, spawnY, {
                        isBlueprint: true,
                        villageId: village.id
                    });

                    if (blueprintId !== null) {
                        console.log(`🏠 Blueprint Spawned: ${nextBuildingType} (ID: ${blueprintId}) at (${spawnX}, ${spawnY})`);
                        village.buildings.add(blueprintId);
                        village.currentTask = { 
                            type: 'build', 
                            buildingType: nextBuildingType, 
                            targetId: blueprintId 
                        };
                    }
                }
            } else {
                // 이미 존재한다면 (완성 체크)
                const isComplete = Array.from(village.buildings).some(bId => {
                    const b = this.entityManager.entities.get(bId);
                    const structure = b?.components.get('Structure');
                    return b && structure && structure.type === nextBuildingType && structure.isComplete;
                });

                if (isComplete) {
                    village.plan.shift();
                    village.currentTask = null;
                }
            }
        }
    }

    getVillage(id) {
        return this.villages.get(id);
    }
}
