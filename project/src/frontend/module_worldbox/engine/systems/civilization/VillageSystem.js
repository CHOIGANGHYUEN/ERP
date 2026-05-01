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
        this._recruitTimer = 0; // 채용 타이머 (틱 최적화)

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
        } else {
            // 무소속 인간 채용: 3초마다 한 번만 실행 (성능 최적화)
            this._recruitTimer -= dt;
            if (this._recruitTimer <= 0) {
                this._recruitVillagers();
                this._recruitTimer = 3.0;
            }
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
            currentTask: null,
            _planningCooldown: 0 // 계획 수립 쿨다운
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

    _recruitVillagers() {
        const em = this.entityManager;
        // 가장 가까운 마을에 편입하도록 거리 기반으로 처리
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const animal = entity.components.get('Animal');
            if (!animal || animal.type !== 'human') continue;

            const civ = entity.components.get('Civilization');
            if (!civ || civ.villageId !== -1) continue; // 이미 소속된 인간은 스킵

            const transform = entity.components.get('Transform');
            if (!transform) continue;

            // 가장 가까운 마을 찾기
            let nearestVillageId = null;
            let minDistSq = Infinity;

            for (const [vid, village] of this.villages) {
                const dx = village.centerX - transform.x;
                const dy = village.centerY - transform.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestVillageId = vid;
                }
            }

            if (nearestVillageId !== null) {
                const village = this.villages.get(nearestVillageId);
                civ.villageId = nearestVillageId;
                village.members.add(id);
                console.log(`👨‍🌾 Entity ${id} joined Village ${nearestVillageId}`);
            }
        }
    }

    _updateVillagePlanning(village) {
        if (village.plan.length === 0) return;

        // ✅ 이미 진행 중인 건설 과업이 있다면, 해당 청사진이 아직 유효한지만 체크
        if (village.currentTask) {
            const taskTarget = this.entityManager.entities.get(village.currentTask.targetId);
            const structure = taskTarget?.components.get('Structure');

            if (!taskTarget) {
                // 청사진이 사라짐 (누군가 지웠거나 오류) → 과업 초기화 후 재계획
                const targetId = village.currentTask?.targetId;
                village.currentTask = null;
                if (targetId) village.buildings.delete(targetId);
            } else if (structure && structure.isComplete) {
                // 건물 완성 → 계획에서 제거
                village.plan.shift();
                village.currentTask = null;
                console.log(`✅ Village ${village.id}: ${structure.type} construction complete!`);
            }
            // 아직 건설 중이면 아무것도 안 함 (인간들이 알아서 지음)
            return;
        }

        // 새 청사진 스폰이 필요한 경우
        const nextBuildingType = village.plan[0];

        // 🔍 이미 이 타입 건물이 있는지 확인 (중복 스폰 방지)
        const hasExisting = Array.from(village.buildings).some(bId => {
            const b = this.entityManager.entities.get(bId);
            const buildingComp = b?.components.get('Building');
            return b && buildingComp && buildingComp.type === nextBuildingType;
        });

        if (hasExisting) {
            // 이미 건물이 있으면 완성 여부 확인
            const isComplete = Array.from(village.buildings).some(bId => {
                const b = this.entityManager.entities.get(bId);
                const structure = b?.components.get('Structure');
                return b && structure && structure.type === nextBuildingType && structure.isComplete;
            });
            if (isComplete) {
                village.plan.shift();
            }
            return;
        }

        // 🌍 지형 검사 후 청사진 생성
        let spawnX, spawnY;
        let foundSpot = false;
        let attempts = 0;

        while (!foundSpot && attempts < 15) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 50 + Math.random() * 80;
            spawnX = village.centerX + Math.cos(angle) * radius;
            spawnY = village.centerY + Math.sin(angle) * radius;

            if (this.engine.terrainGen && this.engine.terrainGen.isLandAt(spawnX, spawnY)) {
                foundSpot = true;
            }
            attempts++;
        }

        if (!foundSpot) return;

        const blueprintId = this.engine.factoryProvider.spawn('building', nextBuildingType, spawnX, spawnY, {
            isBlueprint: true,
            villageId: village.id
        });

        if (blueprintId !== null && blueprintId !== undefined) {
            console.log(`🏠 Blueprint Spawned: ${nextBuildingType} (ID: ${blueprintId}) at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`);
            village.buildings.add(blueprintId);
            village.currentTask = {
                type: 'build',
                buildingType: nextBuildingType,
                targetId: blueprintId
            };
        }
    }

    getVillage(id) {
        return this.villages.get(id);
    }
}
