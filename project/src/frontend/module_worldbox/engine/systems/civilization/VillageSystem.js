import System from '../../core/System.js';
import { JobTypes } from '../../config/JobTypes.js';
import { GlobalLogger } from '../../utils/Logger.js';

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
            // this._assignJobs(village); // 👑 촌장의 직업 할당 로직이 ChiefRole로 이전됨

            // 🚀 개척 체크: 인구가 많고 자원이 충분하면 새로운 마을 건설 시도
            village._expansionCooldown -= dt;
            if (village._expansionCooldown <= 0 && village.members.size >= 10 && village.resources.wood >= 50) {
                this._checkExpansion(village);
                village._expansionCooldown = 120.0; // 다음 개척까지 2분 대기
            }
        }

        // 🚩 국가 관리: 마을이 생겼는데 국가가 없다면 창설
        const ns = this.engine.systemManager?.nationSystem;
        if (ns && this.villages.size > 0 && ns.nations.size === 0) {
            const firstVillageId = Array.from(this.villages.keys())[0];
            const nationId = ns.createNation("First Empire", "#f44336");
            ns.addVillageToNation(nationId, firstVillageId);
        }

        // 시조 인류 체크: 마을이 하나도 없는데 인간이 있다면 마을 생성 시도 (1초에 한 번만 체크)
        if (this.villages.size === 0) {
            this._recruitTimer -= dt;
            if (this._recruitTimer <= 0) {
                this._checkFirstFounder();
                this._recruitTimer = 1.0;
            }
        } else {
            // 무소속 인간 채용: 3초마다 한 번만 실행 (성능 최적화)
            this._recruitTimer -= dt;
            if (this._recruitTimer <= 0) {
                this._recruitVillagers();
                this._processNationEconomy(); // 경제망 업데이트
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
            chiefId: founderId, // 👑 현재 리더 ID
            centerX: x,
            centerY: y,
            members: new Set([founderId]),
            buildings: new Set(),
            resources: { wood: 0, food: 0, stone: 0 },
            resourceMax: { wood: 150, food: 150, stone: 150 },
            resourceNeeds: { wood: 10, food: 15, stone: 0 },
            lastPopulation: 1,
            // 🏘️ 동적 계획을 위한 기본 요구사항 (상태에 따라 유동적으로 변함)
            plan: ['bonfire', 'storage', 'house', 'farm', 'well', 'house', 'blacksmith', 'pasture', 'temple'],
            currentTask: null,
            taskBoard: [], // 📝 마을 할일 목록 (TODO List)
            nationId: -1,
            _planningCooldown: 0,
            _expansionCooldown: 60.0
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
                    GlobalLogger.success(`👑 Entity ${founderId} appointed as CHIEF of Village ${id}`);
                }
            }
        }

        GlobalLogger.success(`🏘️ Village ${id} founded by entity ${founderId} at (${Math.floor(x)}, ${Math.floor(y)})`);

        // 🏗️ PoC: 기본 활동 구역(Zone) 생성
        const zm = this.engine.systemManager?.zoneManager;
        if (zm) {
            // 1. 주거 구역 (마을 중심부)
            const resZoneId = zm.createZone(x - 100, y - 100, 200, 200, 'residential');
            village.residentialZoneId = resZoneId;

            // 2. 벌목 구역 (중심부에서 약간 떨어진 곳)
            const lumberZoneId = zm.createZone(x + 120, y - 100, 200, 200, 'lumber');
            village.lumberZoneId = lumberZoneId;

            // Zones created
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
        // 성능 최적화: 모든 동물이 아닌 '인간' 컴포넌트를 가진 엔티티만 필터링 (가능하다면 em에서 관리)
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const civ = entity.components.get('Civilization');
            if (!civ || civ.villageId !== -1) continue; 

            // 인간인지 최종 확인
            const animal = entity.components.get('Animal');
            if (!animal || animal.type !== 'human') continue;

            const transform = entity.components.get('Transform');
            if (!transform) continue;

            // 가장 가까운 마을 찾기 (마을 수가 적으므로 이 루프는 상대적으로 안전)
            let nearestVillageId = null;
            let minDistSq = 1000 * 1000; // 최대 1000px 거리 제한 추가

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
                GlobalLogger.info(`👨‍🌾 Citizen ${id} has joined Village ${nearestVillageId}.`);
            }
        }
    }

    _cleanupDeadMembers(village) {
        let chiefDied = false;
        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const state = member?.components.get('AIState');
            if (!member || (state && state.mode === 'die')) {
                village.members.delete(memberId);
                if (memberId === village.chiefId) chiefDied = true;
            }
        }

        // 👑 [Succession] 촌장 사망 시 승계 로직 가동
        if (chiefDied || (village.chiefId && !this.entityManager.entities.has(village.chiefId))) {
            this._handleLeadershipSuccession(village);
        }
    }

    /** 👑 촌장 승계 로직: 마을 내 가장 적임자를 선출 */
    _handleLeadershipSuccession(village) {
        if (village.members.size === 0) return;

        // 1. 후보군 선별 (인간 성인 우선)
        const candidates = Array.from(village.members).map(id => ({
            id,
            entity: this.entityManager.entities.get(id)
        })).filter(c => c.entity);

        if (candidates.length === 0) return;

        // 2. 최적의 리더 선출 (여기서는 단순히 첫 번째 후보, 추후 명성/나이 시스템 연동 가능)
        const newChief = candidates[0];
        village.chiefId = newChief.id;

        const civ = newChief.entity.components.get('Civilization');
        if (civ) {
            civ.jobType = JobTypes.CHIEF;
            const roleFactory = this.engine.systemManager?.humanBehavior?.roleFactory;
            if (roleFactory) {
                civ.role = roleFactory.createRole(JobTypes.CHIEF);
                
                // JobController에도 즉시 반영
                const jobCtrl = newChief.entity.components.get('JobController');
                if (jobCtrl) jobCtrl.assignJob(JobTypes.CHIEF);

                this.eventBus.emit('SHOW_SPEECH_BUBBLE', {
                    entityId: newChief.id, text: '👑 NEW CHIEF!', duration: 3000
                });
                GlobalLogger.success(`👑 Succession: Entity ${newChief.id} is the new CHIEF of Village ${village.id}`);
            }
        }
    }

    _recalculateNeeds(village) {
        const pop = village.members.size;
        village.lastPopulation = pop;

        // 📈 [Balance Fix] 대규모 문명을 위한 자원 필요량 상향
        village.resourceNeeds.wood = pop * 15; // 인당 15 목재
        village.resourceNeeds.food = pop * 20; // 인당 20 식량 (허기진 상태 방어)
        village.resourceNeeds.stone = Math.floor(pop * 5); // 석재 수요 도입

        // 저장 용량도 인구 증가에 맞춰 넉넉하게 확장
        village.resourceMax.wood = 200 + pop * 30;
        village.resourceMax.food = 200 + pop * 50;
        village.resourceMax.stone = 200 + pop * 20;
    }

    _syncVillageResources(village) {
        // 모든 건물의 Storage를 합산하여 마을 전체 자원 갱신
        const total = { wood: 0, food: 0, stone: 0 };
        village.buffs = village.buffs || { constructionSpeed: 1.0, morale: 1.0 };

        for (const buildingId of village.buildings) {
            const building = this.entityManager.entities.get(buildingId);
            if (!building) continue;

            const structure = building.components.get('Structure');
            if (structure && structure.isBlueprint && !structure.isComplete) continue;

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

        // 👑 국가 버프 적용
        this._applyNationBuffs(village);
    }

    _applyNationBuffs(village) {
        if (village.nationId === -1) return;

        const ns = this.engine.systemManager?.nationSystem;
        const nation = ns?.nations.get(village.nationId);

        if (nation && nation.kingId) {
            // 왕이 있으면 건설 속도 20% 보너스
            village.buffs.constructionSpeed = 1.2;
            village.buffs.morale = 1.1;
        } else {
            village.buffs.constructionSpeed = 1.0;
            village.buffs.morale = 1.0;
        }
    }

    _processNationEconomy() {
        const ns = this.engine.systemManager?.nationSystem;
        if (!ns) return;

        for (const nation of ns.nations.values()) {
            if (nation.villages.size < 2) continue;

            const villageList = Array.from(nation.villages).map(id => this.villages.get(id)).filter(v => v);

            // 자원이 남는 마을에서 부족한 마을로 지원
            for (const provider of villageList) {
                for (const receiver of villageList) {
                    if (provider.id === receiver.id) continue;

                    // 식량 지원
                    if (provider.resources.food > provider.resourceNeeds.food * 2 && receiver.resources.food < receiver.resourceNeeds.food) {
                        const gift = 10;
                        provider.resources.food -= gift;
                        receiver.resources.food += gift;
                        // 실제 건물의 저장소에서도 빼줘야 하지만, 여기서는 추상화된 자원 동기화로 처리
                        GlobalLogger.info(`📦 Trade: ${provider.name} sent 10 food to ${receiver.name}`);
                    }
                }
            }
        }
    }


    _updateVillagePlanning(village) {
        // 0. 쿨다운 체크
        if (village._planningCooldown > 0) {
            village._planningCooldown -= 0.1; // 대략적인 시간 흐름
            return;
        }

        // 1. 현재 수행 중속인 건설 과업 상태 확인 (유효성 검사)
        if (village.currentTask && village.currentTask.type === 'build') {
            const taskTarget = this.entityManager.entities.get(village.currentTask.targetId);
            const structure = taskTarget?.components.get('Structure');

            if (!taskTarget || (structure && structure.isComplete)) {
                village.currentTask = null;
                if (structure && structure.isComplete) {
                    village._planningCooldown = 5.0; // 건설 완료 후 휴식
                }
            }
        }

        // 2. 현재 과업이 없으면 마을 내 미완공 청사진 탐색하여 할당
        if (!village.currentTask) {
            for (const bId of village.buildings) {
                const b = this.entityManager.entities.get(bId);
                const struc = b?.components.get('Structure');
                if (struc && !struc.isComplete) {
                    village.currentTask = {
                        type: 'build',
                        buildingType: b.components.get('Building')?.type || 'unknown',
                        targetId: bId
                    };
                    break; 
                }
            }
        }

        // 이미 과업이 있거나 쿨다운 중이면 계획 단계 스킵
        if (village.currentTask || village._planningCooldown > 0) return;

        // 3. [Natural Progression] 마을의 상태를 분석하여 필요한 건물 결정
        let nextBuildingType = null;
        
        // 👑 [Chief Priority] 촌장의 계획(plan)이 있다면 최우선으로 반영
        if (village.plan && village.plan.length > 0) {
            nextBuildingType = village.plan.shift();
        } else {
            nextBuildingType = this._analyzeVillageNeeds(village);
        }

        if (!nextBuildingType) return;

        // 🌍 지형 검사 후 청사진 생성 (토양 지형 우선)
        let spawnX = 0;
        let spawnY = 0;
        let foundSpot = false;
        let attempts = 0;
        const maxAttempts = 15; // 🚀 성능 유지를 위해 다시 원래 수준으로 환원

        while (!foundSpot && attempts < maxAttempts) {
            attempts++; 
            
            const angle = Math.random() * Math.PI * 2;
            const radius = 50 + (attempts / maxAttempts) * 150;
            spawnX = village.centerX + Math.cos(angle) * radius;
            spawnY = village.centerY + Math.sin(angle) * radius;

            // 🗺️ 맵 경계 체크 추가
            if (spawnX < 50 || spawnX > this.engine.mapWidth - 50 || spawnY < 50 || spawnY > this.engine.mapHeight - 50) continue;

            if (this.engine.terrainGen && this.engine.terrainGen.isSoilAt(spawnX, spawnY)) {
                const isTooClose = Array.from(village.buildings).some(bId => {
                    const b = this.entityManager.entities.get(bId);
                    const bPos = b?.components.get('Transform');
                    if (!bPos) return false;
                    const dx = bPos.x - spawnX;
                    const dy = bPos.y - spawnY;
                    return (dx * dx + dy * dy) < (60 * 60); 
                });

                if (!isTooClose) {
                    foundSpot = true;
                }
            }
        }

        if (!foundSpot) return;

        const blueprintId = Number(this.engine.factoryProvider.spawn('building', nextBuildingType, spawnX, spawnY, {
            isBlueprint: true,
            villageId: village.id
        }));
        
        if (!isNaN(blueprintId)) {
            GlobalLogger.info(`🏠 Blueprint Spawned: ${nextBuildingType} at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`);
            village.buildings.add(blueprintId);
            village.currentTask = {
                type: 'build',
                buildingType: nextBuildingType,
                targetId: blueprintId
            };
            village._planningCooldown = 10.0; // 청사진 생성 후 딜레이
        }
    }

    /** 🧠 마을 필요도 분석 로직 (Natural Progression) */
    _analyzeVillageNeeds(village) {
        const buildings = Array.from(village.buildings).map(id => this.entityManager.entities.get(id)).filter(e => e);
        const pop = village.members.size;

        // 1. 기초 시설 (Bonfire, Storage)
        const hasBonfire = buildings.some(b => b.components.get('Building')?.type === 'bonfire');
        if (!hasBonfire) return 'bonfire';

        const hasStorage = buildings.some(b => b.components.get('Building')?.type === 'storage' || b.components.get('Building')?.type === 'warehouse');
        if (!hasStorage) return 'storage';

        // 2. 주거 공간 체크 (인구 대비 수용량)
        let totalCapacity = 0;
        buildings.forEach(b => {
            const housing = b.components.get('Housing');
            const structure = b.components.get('Structure');
            if (housing && structure?.isComplete) totalCapacity += housing.capacity;
        });

        if (totalCapacity < pop + 2) return 'house';

        // 3. 식량 공급원 체크
        const farmCount = buildings.filter(b => b.components.get('Building')?.type === 'farm').length;
        if (farmCount < Math.ceil(pop / 4)) return 'farm';

        // 4. 고급 시설 (Well, Blacksmith, Temple) - 조건부 건설
        const hasWell = buildings.some(b => b.components.get('Building')?.type === 'well');
        if (!hasWell && pop >= 6) return 'well';

        const hasBlacksmith = buildings.some(b => b.components.get('Building')?.type === 'blacksmith');
        if (!hasBlacksmith && pop >= 10 && village.resources.stone >= 30) return 'blacksmith';

        const hasTemple = buildings.some(b => b.components.get('Building')?.type === 'temple');
        if (!hasTemple && pop >= 15) return 'temple';

        // 5. 방어 시설
        const towerCount = buildings.filter(b => b.components.get('Building')?.type === 'watchtower').length;
        if (towerCount < Math.ceil(pop / 8)) return 'watchtower';

        return null;
    }


    _checkExpansion(village) {
        // 개척자 선발 (직업이 없는 인간 중 한 명)
        const candidates = Array.from(village.members).filter(id => {
            const ent = this.entityManager.entities.get(id);
            const civ = ent?.components.get('Civilization');
            return civ && (civ.jobType === JobTypes.UNEMPLOYED || !civ.jobType);
        });

        if (candidates.length > 0) {
            const explorerId = candidates[0];
            const explorer = this.entityManager.entities.get(explorerId);
            const transform = explorer?.components.get('Transform');
            if (!transform) return;

            // 새로운 마을 위치 선정 (맵이 2400x2400으로 커졌으므로 개척 거리를 600~1000px로 대폭 상향)
            const angle = Math.random() * Math.PI * 2;
            const dist = 600 + Math.random() * 400;
            const newX = village.centerX + Math.cos(angle) * dist;
            const newY = village.centerY + Math.sin(angle) * dist;

            // 경계 체크 (맵 밖으로 나가지 않게)
            const mapW = this.engine.mapWidth;
            const mapH = this.engine.mapHeight;
            if (newX < 50 || newX > mapW - 50 || newY < 50 || newY > mapH - 50) return;

            // 자원 소모 (나무 50)
            village.resources.wood -= 50;

            // 현재 마을에서 탈퇴
            village.members.delete(explorerId);
            const civ = explorer.components.get('Civilization');
            if (civ) civ.villageId = -1;

            // 새로운 마을 창설!
            const newVid = this.createVillage({ founderId: explorerId, x: newX, y: newY });

            // 국가 시스템이 있다면 자동으로 같은 국가에 소속시킴
            if (village.nationId !== -1) {
                const ns = this.engine.systemManager?.nationSystem;
                if (ns) ns.addVillageToNation(village.nationId, newVid);
            }

            GlobalLogger.success(`🚀 Expansion! Entity ${explorerId} left to found a new village at (${newX.toFixed(0)}, ${newY.toFixed(0)})`);
        }
    }

    getVillage(id) {
        return this.villages.get(id);
    }
}
