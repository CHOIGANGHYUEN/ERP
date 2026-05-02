import System from '../../core/System.js';
import { JobTypes } from '../../config/JobTypes.js';

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
        // 마을 발전 상태 체크 및 건설 계획 수립, 인구/자원 관리
        for (const village of this.villages.values()) {
            this._cleanupDeadMembers(village);

            if (village.lastPopulation !== village.members.size) {
                this._recalculateNeeds(village);
            }

            this._syncVillageResources(village);
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
                this._recruitTimer = 0.5; // 0.5초마다 무소속 채용 (반응성 대폭 상향)
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
            resourceMax: { wood: 150, food: 150, stone: 150 },
            resourceNeeds: { wood: 10, food: 15, stone: 0 },
            lastPopulation: 1,
            plan: [], // 🏗️ 이제 촌장이 직접 계획을 수립합니다.
            currentTask: null,
            _planningCooldown: 0 // 계획 수립 쿨다운
        };

        this.villages.set(id, village);

        // 창립자에게 마을 정보 주입
        const founder = this.entityManager.entities.get(founderId);
        if (founder) {
            const civ = founder.components.get('Civilization');
            if (civ) {
                civ.villageId = id;
                // 👑 창립자를 촌장으로 임명
                civ.jobType = JobTypes.CHIEF;
                const roleFactory = this.engine.systemManager?.humanBehavior?.roleFactory;
                if (roleFactory) {
                    civ.role = roleFactory.createRole(JobTypes.CHIEF);
                    console.log(`👑 Entity ${founderId} appointed as CHIEF of Village ${id}`);
                }
            }
        }

        console.log(`🏘️ Village founded by entity ${founderId} at (${x}, ${y})`);
        
        // 🏗️ PoC: 기본 활동 구역(Zone) 생성
        const zm = this.engine.systemManager?.zoneManager;
        if (zm) {
            // 1. 주거 구역 (마을 중심부)
            const resZoneId = zm.createZone(x - 100, y - 100, 200, 200, 'residential');
            village.residentialZoneId = resZoneId;
            
            // 2. 벌목 구역 (중심부에서 약간 떨어진 곳)
            const lumberZoneId = zm.createZone(x + 120, y - 100, 200, 200, 'lumber');
            village.lumberZoneId = lumberZoneId;
            
            console.log(`🗺️ Default zones created for Village ${id}: Residential(${resZoneId}), Lumber(${lumberZoneId})`);
        }

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

    _cleanupDeadMembers(village) {
        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const state = member?.components.get('AIState');
            if (!member || (state && state.mode === 'die')) {
                village.members.delete(memberId);
            }
        }
    }

    _recalculateNeeds(village) {
        const pop = village.members.size;
        village.lastPopulation = pop;

        // 인구 1명당 나무 10, 식량 15 필요
        village.resourceNeeds.wood = pop * 10;
        village.resourceNeeds.food = pop * 15;
        // 최대치도 인구에 비례해서 늘어남 (기본 150 + 1인당 추가 여유 공간)
        village.resourceMax.wood = 150 + pop * 20;
        village.resourceMax.food = 150 + pop * 30;

        console.log(`🏘️ Village ${village.id} population changed to ${pop}. Needs recalculated.`);
    }

    _syncVillageResources(village) {
        // 모든 건물의 Storage를 합산하여 마을 전체 자원 갱신
        const total = { wood: 0, food: 0, stone: 0 };

        for (const buildingId of village.buildings) {
            const building = this.entityManager.entities.get(buildingId);
            if (!building) continue;

            const storage = building.components.get('Storage');
            if (storage && storage.items) {
                for (const type in storage.items) {
                    const amt = storage.items[type];
                    // 고기, 베리류 등을 포괄적인 'food' 자원으로 합산
                    if (['meat', 'berry', 'wheat', 'food'].includes(type)) {
                        total.food += amt;
                    } else {
                        total[type] = (total[type] || 0) + amt; // 기타 자원은 각각의 이름으로 합산
                    }
                }
            }
        }

        village.resources.wood = total.wood;
        village.resources.food = total.food;
        village.resources.stone = total.stone;
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

        // 🌍 지형 검사 후 청사진 생성 (토양 지형 우선)
        let spawnX = 0;
        let spawnY = 0;
        let foundSpot = false;
        let attempts = 0;
        const maxAttempts = 15; // 🚀 성능 유지를 위해 다시 원래 수준으로 환원

        while (!foundSpot && attempts < maxAttempts) {
            // 마을 중심에서 점진적으로 멀어지며 탐색
            const angle = Math.random() * Math.PI * 2;
            const radius = 40 + (attempts / maxAttempts) * 150;
            spawnX = village.centerX + Math.cos(angle) * radius;
            spawnY = village.centerY + Math.sin(angle) * radius;

            // 1. 토양 지형인지 확인 (개선된 isSoilAt 사용)
            if (this.engine.terrainGen && this.engine.terrainGen.isSoilAt(spawnX, spawnY)) {
                // 2. 근처에 이미 건물이 있는지 확인 (너무 촘촘하게 짓지 않도록)
                const isTooClose = Array.from(village.buildings).some(bId => {
                    const b = this.entityManager.entities.get(bId);
                    const bPos = b?.components.get('Transform');
                    if (!bPos) return false;
                    const dx = bPos.x - spawnX;
                    const dy = bPos.y - spawnY;
                    return (dx * dx + dy * dy) < (50 * 50); // 최소 50px 간격 유지
                });

                if (!isTooClose) {
                    foundSpot = true;
                }
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
