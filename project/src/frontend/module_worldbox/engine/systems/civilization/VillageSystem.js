import System from '../../core/System.js';
import { JobTypes } from '../../config/JobTypes.js';
import { VillageTypes, VillageBonuses } from '../../config/VillageTypes.js';
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
        this._scheduleTimer = 0; // [Task 58] 동적 직업 스케줄링 타이머
        this._SCHEDULE_INTERVAL = 15.0; // 15초마다 긴급 재배치 평가
        this._jobTypes = JobTypes; // 동기 캐시 (이미 import됨)

        // 📡 Listen for events
        this.eventBus.on('CREATE_VILLAGE', (payload) => this.createVillage(payload));
        // 📦 [Event Listeners] 저장소 관리 및 자원 동기화
        this.eventBus.on('BUILDING_COMPLETE', (data) => this._onBuildingComplete(data));
        this.eventBus.on('STORAGE_CHANGED', (data) => this._onStorageChanged(data));
        this.eventBus.on('VILLAGER_DEATH', (data) => this._onVillagerDeath(data));

        this.dirtyVillages = new Set(); // 🚀 [Optimization]
    }

    /** 🔍 [Specialization] 주변 자원 밀도를 분석하여 마을의 전문 분야를 결정합니다. */
    _determineSpecialization(x, y) {
        const radius = 300;
        const sh = this.engine.spatialHash;
        if (!sh) return VillageTypes.GENERAL;

        const nearbyIds = sh.query(x, y, radius);
        let treeCount = 0;
        let mineralCount = 0;
        let foodCount = 0;

        for (const id of nearbyIds) {
            const ent = this.entityManager.entities.get(id);
            const res = ent?.components.get('Resource');
            if (res) {
                if (res.type === 'tree') treeCount++;
                else if (['stone', 'iron_ore', 'gold_ore'].includes(res.type)) mineralCount++;
                else if (['berry', 'food'].includes(res.type)) foodCount++;
            }
        }

        // 지형 비옥도 체크
        const tg = this.engine.terrainGen;
        let avgFertility = 0;
        if (tg) {
            const index = tg.getIndex(x, y);
            avgFertility = tg.fertilityBuffer ? tg.fertilityBuffer[index] : 0;
        }

        if (treeCount > mineralCount && treeCount > foodCount + 5) return VillageTypes.LUMBERING;
        if (mineralCount > treeCount && mineralCount > foodCount + 5) return VillageTypes.MINING;
        if (foodCount > 10 || avgFertility > 180) return VillageTypes.AGRICULTURAL;

        return VillageTypes.GENERAL;
    }

    _onBuildingComplete(data) {
        const { id, type, villageId } = data;
        if (villageId === undefined || villageId === -1) return;

        const village = this.villages.get(villageId);
        if (!village) return;

        const entity = this.entityManager.entities.get(id);
        if (entity && entity.components.has('Storage')) {
            if (!village.storageIds) village.storageIds = new Set();
            village.storageIds.add(id);
            this.syncResources(village);
            GlobalLogger.info(`📦 New Storage registered to Village ${village.name}: Entity ${id}`);
        }
    }

    _onStorageChanged(data) {
        const { entityId } = data;
        const ent = this.entityManager.entities.get(entityId);
        const civ = ent?.components.get('Civilization');
        if (civ && civ.villageId !== -1) {
            this.dirtyVillages.add(civ.villageId);
        }
    }

    _onVillagerDeath(data) {
        const { entityId, villageId } = data;
        const village = this.villages.get(villageId);
        if (village) {
            village.members.delete(entityId);
            if (entityId === village.chiefId) {
                this._handleLeadershipSuccession(village);
            }
        }
    }

    update(dt, time) {
        // 마을 발전 상태 체크 및 건설 계획 수립, 인구/자원 관리
        for (const village of this.villages.values()) {
            this._cleanupDeadMembers(village);

            if (village.lastPopulation !== village.members.size) {
                this._recalculateNeeds(village);
            }
            // 🗺️ 영토 확장은 이제 촌장(ChiefRole) AI가 지능적으로 수행합니다.

            this._updateVillagePlanning(village);
            // this._assignJobs(village); // 👑 촌장의 직업 할당 로직이 ChiefRole로 이전됨

            // 🚀 개척 체크: 인구가 많고 자원이 충분하면 새로운 마을 건설 시도
            village._expansionCooldown -= dt;
            if (village._expansionCooldown <= 0 && village.members.size >= 10 && village.resources.wood >= 50) {
                this._checkExpansion(village);
                village._expansionCooldown = 120.0; // 다음 개척까지 2분 대기
            }

            // 🏛️ [Nation Dependency] 국가의 정책 및 상태에 따른 마을 영향력 업데이트
            this._updateNationalInfluence(village, dt);
        }

        // ⚡ [Task 58] 동적 직업 스케줄링 (15초마다 긴급 재배치)
        this._scheduleTimer -= dt;
        if (this._scheduleTimer <= 0) {
            this._scheduleTimer = this._SCHEDULE_INTERVAL;
            for (const village of this.villages.values()) {
                this._dynamicJobSchedule(village);
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

        // 🚀 [Optimization] Dirty Village Sync (Once per frame)
        if (this.dirtyVillages.size > 0) {
            for (const vid of this.dirtyVillages) {
                const v = this.villages.get(vid);
                if (v) this.syncResources(v);
            }
            this.dirtyVillages.clear();
        }
    }


    createVillage({ founderId, x, y, nationIdOverride = -1 }) {
        const id = this.nextVillageId++;
        const village = {
            id,
            name: `Village ${id}`,
            founderId,
            chiefId: founderId,
            centerX: x,
            centerY: y,
            members: new Set([founderId]),
            buildings: new Set(),
            storageIds: new Set(),
            territory: new Set(),
            nationId: nationIdOverride,
            type: this._determineSpecialization(x, y), // 💎 [Specialization] 초기화
            resources: { wood: 0, food: 0, stone: 0, gold: 0 },
            resourceMax: { wood: 150, food: 150, stone: 150 },
            resourceNeeds: { wood: 10, food: 15, stone: 0 },
            lastPopulation: 1,
            plan: ['bonfire', 'storage', 'house', 'farm', 'well', 'house', 'blacksmith', 'pasture', 'temple'],
            currentTask: null,
            taskBoard: [],
            loyalty: 70,
            unrest: 0,
            lastRebellionCheck: 0,
            _planningCooldown: 0,
            _expansionCooldown: 60.0,
            territorySize: 1,
            buffs: {
                constructionSpeed: 1.0,
                morale: 1.0,
                gatherEfficiency: 1.0
            }
        };

        // 🗺️ [Irregular Territory] 초기 영토 생성 (기본 9타일 + 확장)
        village.territory = new Set();
        const startTx = Math.floor(x / 16);
        const startTy = Math.floor(y / 16);
        
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const tx = startTx + dx;
                const ty = startTy + dy;
                const key = (ty << 16) | tx;
                
                // 🚀 [Strict Overlap Check] 이미 다른 마을의 영토라면 제외
                let isClaimed = false;
                // 1. TerrainGen 버퍼 체크 (가장 정확함)
                const tg = this.engine.terrainGen;
                if (tg && tg.territoryBuffer) {
                    const rowOff = ty * 16 * this.engine.mapWidth; // 16x16 타일 영역의 시작행
                    const idx = rowOff + (tx * 16);
                    if (tg.territoryBuffer[idx] > 0) isClaimed = true;
                }

                // 2. 다른 마을 객체 전수 조사 (백업)
                if (!isClaimed) {
                    for (const v of this.villages.values()) {
                        if (v.territory && v.territory.has(key)) {
                            isClaimed = true;
                            break;
                        }
                    }
                }
                if (!isClaimed) village.territory.add(key);
            }
        }
        const tg = this.engine.terrainGen;
        while (village.territory.size < 100) {
            const candidates = [];
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const key of village.territory) {
                const tx = key & 0xFFFF;
                const ty = key >> 16;
                for (const [dx, dy] of dirs) {
                    const nx = tx + dx, ny = ty + dy;
                    const nKey = (ny << 16) | nx;
                    if (!village.territory.has(nKey)) {
                        if (tg && tg.isLandAt(nx * 16 + 8, ny * 16 + 8)) candidates.push(nKey);
                    }
                }
            }
            if (candidates.length === 0) break;
            village.territory.add(candidates[Math.floor(Math.random() * candidates.length)]);
        }

        // 🎨 [Optimization] Pre-calculate integer color for rendering
        this._updateIntColor(village);

        this.villages.set(id, village);

        // 🗺️ [Engine Buffer Sync] 영토 버퍼 동기화
        const territoryBuffer = this.engine.terrainGen?.territoryBuffer;
        if (territoryBuffer) {
            for (const key of village.territory) {
                const tx = key & 0xFFFF;
                const ty = key >> 16;
                // 16x16 타일 영역 전체를 채우기
                for (let dy = 0; dy < 16; dy++) {
                    const rowOff = (ty * 16 + dy) * this.engine.mapWidth;
                    for (let dx = 0; dx < 16; dx++) {
                        const idx = rowOff + (tx * 16 + dx);
                        if (idx >= 0 && idx < territoryBuffer.length) {
                            territoryBuffer[idx] = id; // 1-indexed (id is already 1+)
                        }
                    }
                }
            }
        }

        // 👑 [Nation Assignment] 국가 설정 (독립 창설인 경우 새로운 국가 생성)
        const ns = this.engine.systemManager?.nationSystem;
        if (ns) {
            if (nationIdOverride === -1) {
                // 독립 창설: 새로운 국가 창설 (색상은 NationSystem에서 자동 생성)
                const nationName = `Empire ${id}`;
                const newNationId = ns.createNation(nationName);
                ns.addVillageToNation(newNationId, id);
            } else {
                // 파견/개척: 기존 국가에 소속
                ns.addVillageToNation(nationIdOverride, id);
            }
        }

        // 창립자 정보 갱신
        const founder = this.entityManager.entities.get(founderId);
        if (founder) {
            const civ = founder.components.get('Civilization');
            if (civ) {
                civ.villageId = id;
                civ.jobType = JobTypes.CHIEF;
                const roleFactory = this.engine.systemManager?.humanBehavior?.roleFactory;
                if (roleFactory) civ.role = roleFactory.createRole(JobTypes.CHIEF);
            }
        }

        // 🏗️ [Zone System] 초기 영역 할당 및 구역 균형 조정
        const zm = this.engine.systemManager?.zoneManager;
        if (zm) {
            village.residentialZoneId = zm.createZone(0, 0, 16, 16, 'residential');
            village.lumberZoneId = zm.createZone(0, 0, 16, 16, 'gathering');
            zm.getZone(village.residentialZoneId).villageId = id;
            zm.getZone(village.lumberZoneId).villageId = id;
            zm.rebalanceVillageZones(id);
        }

        this.eventBus.emit('VILLAGE_FOUNDED', { villageId: id, x, y });
        return id;
    }

    _getRandomColor() {
        const colors = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', 
            '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', 
            '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', 
            '#ff5722', '#795548', '#607d8b', '#333333'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    _updateIntColor(village) {
        const c = village.color || '#ffffff';
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        // Little Endian (AABBGGRR) for ChunkManager/ImageData
        village.intColor = (255 << 24) | (b << 16) | (g << 8) | r;
        // Big Endian (RRGGBB) for TerrainGen
        village.rgbColor = (r << 16) | (g << 8) | b;

        // 🎨 [Sync] 고성능 렌더링을 위한 버퍼 동기화
        if (this.engine.terrainGen) {
            this.engine.terrainGen.syncVillageColor(village.id, village.rgbColor);
        }
    }

    _checkFirstFounder() {
        const em = this.entityManager;
        for (const id of em.humanIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            const transform = entity.components.get('Transform');
            if (transform) {
                this.createVillage({ founderId: id, x: transform.x, y: transform.y });
                break;
            }
        }
    }

    _recruitVillagers() {
        const em = this.entityManager;
        for (const id of em.humanIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const civ = entity.components.get('Civilization');
            if (!civ || civ.villageId !== -1) continue;

            const transform = entity.components.get('Transform');
            if (!transform) continue;

            // 1. [Intelligence] 영토 버퍼 및 거리 기반 지능적 영입 로직
            let hostVillage = null;
            let minCenterDist = Infinity;
            let nearestVillage = null;

            // A. 영토 버퍼(TerrainGen) 우선 확인 (시각적 일치성 보장)
            const tg = this.engine.terrainGen;
            if (tg && tg.territoryBuffer) {
                const idx = tg.getIndex(transform.x, transform.y);
                const villageId = tg.territoryBuffer[idx];
                if (villageId > 0) {
                    hostVillage = this.villages.get(villageId);
                }
            }

            // B. 영토 버퍼에서 못 찾았다면 근처 마을 센터와의 거리 확인
            if (!hostVillage) {
                for (const village of this.villages.values()) {
                    const dx = village.centerX - transform.x;
                    const dy = village.centerY - transform.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < minCenterDist) {
                        minCenterDist = dist;
                        nearestVillage = village;
                    }
                }

                // 🏘️ [Proximity Rule] 반경 200px 이내에 마을이 있다면 해당 마을 시민으로 합류
                if (nearestVillage && minCenterDist < 200) {
                    hostVillage = nearestVillage;
                }
            }

            if (hostVillage) {
                // 영토 내부이거나 충분히 가까우면 해당 마을 시민으로 영입
                civ.villageId = hostVillage.id;
                civ.nationId = hostVillage.nationId;
                hostVillage.members.add(id);
                
                // 🛠️ [Job Init] 영입 시 즉시 무직으로 설정하여 촌장이 직업을 주도록 유도
                civ.jobType = JobTypes.UNEMPLOYED; 
                
                GlobalLogger.info(`👨‍🌾 Entity ${id} joined ${hostVillage.name} (Proximity/Territory).`);
                if (this.eventBus) this.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId: id, text: '🏘️', duration: 1500 });
            } else if (minCenterDist > 400) {
                // 🚀 [New Faction] 주변에 마을이 전혀 없는 오지(400px 밖)에서만 새로운 세력 창설
                this.createVillage({ founderId: id, x: transform.x, y: transform.y, nationIdOverride: -1 });
                GlobalLogger.warn(`🚩 Entity ${id} founded a new village at (${Math.floor(transform.x)}, ${Math.floor(transform.y)})`);
            } else {
                // 어중간한 거리(200~400px)에 있으면 무소속 상태를 유지하며 배회 (다음 주기에 재시도)
                if (Math.random() < 0.05) {
                    this.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId: id, text: '❓', duration: 1000 });
                }
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
        const bonuses = VillageBonuses[village.type] || VillageBonuses[VillageTypes.GENERAL];
        
        village.resourceMax.wood = (200 + pop * 30) + (bonuses.maxWoodBonus || 0);
        village.resourceMax.food = (200 + pop * 50) + (bonuses.maxFoodBonus || 0);
        village.resourceMax.stone = (200 + pop * 20) + (bonuses.maxStoneBonus || 0);

        // [General Bonus] 전용
        if (village.type === VillageTypes.GENERAL) {
            const b = bonuses.maxAllBonus || 0;
            village.resourceMax.wood += b;
            village.resourceMax.food += b;
            village.resourceMax.stone += b;
        }
        
        // 📦 [Storage Sync] 마을 내 모든 저장소의 자원을 통합 동기화
        this.syncResources(village);
    }

    /** 📦 [Economy] 마을 내 모든 저장소의 자원을 통합 동기화하여 마을 자원 데이터에 반영합니다. */
    syncResources(village) {
        const total = { wood: 0, food: 0, stone: 0, gold: 0 };
        if (!village.storageIds) village.storageIds = new Set();

        // 1. 등록된 저장소(storageIds) 우선 순회
        if (village.storageIds.size > 0) {
            for (const storageId of village.storageIds) {
                const ent = this.entityManager.entities.get(storageId);
                const storage = ent?.components.get('Storage');
                if (storage && storage.items) {
                    for (const [type, amount] of Object.entries(storage.items)) {
                        const amt = Number(amount);
                        if (['meat', 'berry', 'wheat', 'food'].includes(type.toLowerCase())) {
                            total.food += amt;
                        } else if (total[type] !== undefined) {
                            total[type] += amt;
                        } else {
                            total[type] = amt;
                        }
                    }
                }
            }
        } else {
            // 2. 등록된 저장소가 없으면 전체 건물을 순회하는 Fallback 수행 (하위 호환성)
            for (const buildingId of village.buildings) {
                const b = this.entityManager.entities.get(buildingId);
                const storage = b?.components.get('Storage');
                if (storage && storage.items) {
                    for (const [type, amount] of Object.entries(storage.items)) {
                        const amt = Number(amount);
                        if (['meat', 'berry', 'wheat', 'food'].includes(type.toLowerCase())) total.food += amt;
                        else if (total[type] !== undefined) total[type] += amt;
                    }
                }
            }
        }
        
        village.resources = total;
        village.buffs = village.buffs || { constructionSpeed: 1.0, morale: 1.0, gatherEfficiency: 1.0 };
        
        // 💎 [Specialization Buffs] 적용
        const bonuses = VillageBonuses[village.type] || VillageBonuses[VillageTypes.GENERAL];
        village.buffs.foodGatherRate = bonuses.foodGatherRate || 1.0;
        village.buffs.woodGatherRate = bonuses.woodGatherRate || 1.0;
        village.buffs.stoneGatherRate = bonuses.stoneGatherRate || 1.0;

        this._applyNationBuffs(village);
    }

    _applyNationBuffs(village) {
        if (village.nationId === -1) return;

        const ns = this.engine.systemManager?.nationSystem;
        const nation = ns?.nations.get(village.nationId);
        if (!nation) return;

        // 1. 왕의 존재 여부에 따른 보너스
        if (nation.kingId) {
            village.buffs.constructionSpeed = 1.2;
            village.buffs.morale = 1.1;
        } else {
            village.buffs.constructionSpeed = 1.0;
            village.buffs.morale = 1.0;
        }

        // 2. 국가 기술 수준(Tech)에 따른 추가 보너스
        const techLevel = Math.floor(nation.tech || 0);
        village.buffs.gatherEfficiency = 1.0 + (techLevel * 0.05); // 레벨당 5% 채집 효율 증가
        village.buffs.constructionSpeed *= (1.0 + techLevel * 0.02); // 레벨당 2% 건설 속도 증가
    }

    /** 🏛️ [National Influence] 국가의 정책을 마을에 반영합니다. */
    _updateNationalInfluence(village, dt) {
        if (village.nationId === -1) return;
        const ns = this.engine.systemManager?.nationSystem;
        const nation = ns?.nations.get(village.nationId);
        if (!nation || !nation.policies) return;

        // 개척 정책: 확장이 잦을수록 개척 쿨다운 감소
        if (nation.policies.expansion > 1.0) {
            village._expansionCooldown -= (dt * (nation.policies.expansion - 1.0));
        }

        // 특정 분야 집중 (Focus)
        switch (nation.policies.focus) {
            case 'military':
                village.buffs.morale = (village.buffs.morale || 1.0) * 1.2;
                break;
            case 'economy':
                village.buffs.gatherEfficiency *= 1.1;
                break;
            case 'culture':
                // 문화 집중 시 영토 확장 속도 증가 (Task 43 연계)
                village.cultureRate = 1.5;
                break;
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

                    ['food', 'wood', 'stone'].forEach(resType => {
                        // 자원 풍족도( Needs의 3배 이상)와 부족도(Needs 미만)를 기준으로 무역 발생
                        const providerNeed = provider.resourceNeeds[resType] || 20;
                        const receiverNeed = receiver.resourceNeeds[resType] || 20;

                        if (provider.resources[resType] > providerNeed * 3 && receiver.resources[resType] < receiverNeed) {
                            const giftAmount = 20;
                            
                            // 📦 [Physical Trade] 실제 창고(Storage)에서 자원 차감 및 주입
                            let remainingToWithdraw = giftAmount;
                            if (provider.storageIds && provider.storageIds.size > 0) {
                                for (const sid of provider.storageIds) {
                                    const sEnt = this.entityManager.entities.get(sid);
                                    const storage = sEnt?.components.get('Storage');
                                    if (storage) {
                                        const taken = storage.withdraw(resType, remainingToWithdraw);
                                        remainingToWithdraw -= taken;
                                        if (remainingToWithdraw <= 0) break;
                                    }
                                }
                            }

                            const actualMoved = giftAmount - remainingToWithdraw;
                            if (actualMoved > 0 && receiver.storageIds && receiver.storageIds.size > 0) {
                                const targetSid = Array.from(receiver.storageIds)[0];
                                const targetEnt = this.entityManager.entities.get(targetSid);
                                const targetStorage = targetEnt?.components.get('Storage');
                                if (targetStorage) {
                                    targetStorage.addItem(resType, actualMoved);
                                    
                                    GlobalLogger.info(`📦 Trade: ${provider.name} sent ${actualMoved} ${resType} to ${receiver.name}`);
                                    // 무역 효과음을 내거나 말풍선 표시 (선택사항)
                                    this.eventBus.emit('SHOW_SPEECH_BUBBLE', { 
                                        entityId: provider.chiefId, text: `📦 Exporting ${resType}`, duration: 2000 
                                    });
                                }
                            }
                        }
                    });
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
        const maxAttempts = 25; // 🚀 Zone 내부 공간 탐색을 위해 탐색 횟수를 약간 상향

        // 🗺️ [Zone System] 건물 종류별 적합한 구역(Zone) 탐색
        const zm = this.engine.systemManager?.zoneManager;
        let targetZone = null;
        if (zm) {
            // 기본 건물은 주거 구역(residential)에 건설
            let targetZoneId = village.residentialZoneId;
            if (targetZoneId) targetZone = zm.getZone(targetZoneId);
        }

        while (!foundSpot && attempts < maxAttempts) {
            attempts++;

            if (targetZone && targetZone.villageId !== undefined && village.territory && village.territory.size > 0) {
                // 🗺️ 불규칙 타일 영역(Zone) 내부에서만 스폰 위치 선정
                const b = targetZone.bounds;
                const tiles = Array.from(village.territory);
                const validTiles = tiles.filter(key => {
                    const tx = key & 0xFFFF;
                    const ty = key >> 16;
                    const cx = tx * 16 + 8;
                    const cy = ty * 16 + 8;
                    return cx >= b.minX && cx <= b.minX + b.width && cy >= b.minY && cy <= b.minY + b.height;
                });

                if (validTiles.length > 0) {
                    const rTile = validTiles[Math.floor(Math.random() * validTiles.length)];
                    const tx = rTile & 0xFFFF;
                    const ty = rTile >> 16;
                    spawnX = tx * 16 + 4 + Math.random() * 8;
                    spawnY = ty * 16 + 4 + Math.random() * 8;
                } else {
                    spawnX = b.minX + 10 + Math.random() * (b.width - 20);
                    spawnY = b.minY + 10 + Math.random() * (b.height - 20);
                }
            } else if (targetZone && targetZone.bounds) {
                const b = targetZone.bounds;
                spawnX = b.minX + 10 + Math.random() * (b.width - 20);
                spawnY = b.minY + 10 + Math.random() * (b.height - 20);
            } else {
                const angle = Math.random() * Math.PI * 2;
                const radius = 50 + (attempts / maxAttempts) * 150;
                spawnX = village.centerX + Math.cos(angle) * radius;
                spawnY = village.centerY + Math.sin(angle) * radius;
            }

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

            // 🚀 새로운 마을 창설! (기존 국가를 계승함)
            const newVid = this.createVillage({ 
                founderId: explorerId, 
                x: newX, 
                y: newY, 
                nationIdOverride: village.nationId 
            });

            GlobalLogger.success(`🚀 Expansion! Entity ${explorerId} left to found a new village at (${newX.toFixed(0)}, ${newY.toFixed(0)})`);
        }
    }

    getVillage(id) {
        return this.villages.get(id);
    }

    /**
     * 🎨 [Village Territory Render] 마을 영역을 타일(Grid) 형태로 뚜렷하게 화면에 렌더링합니다.
     */
    render(ctx, camera) {
        const viewFlags = this.engine.viewFlags || {};
        // 💡 [핵심] VILLAGETILE 플래그를 인식하여 타일 렌더링이 도중에 튕기지 않고 그려지게 합니다.
        const isActive = viewFlags.VILLAGETILE || viewFlags.showVillageInfo || viewFlags.showVillages || viewFlags.NATIONTILE || viewFlags.nation;
        if (!isActive) return;

        ctx.save();
        const TILE_SIZE = 16;

        for (const village of this.villages.values()) {
            if (!village.territory || village.territory.size === 0) continue;

            // 국가별 고유 색상 (국가가 없으면 기본 색상)
            let colorHex = '#4fc3f7';
            if (village.nationId !== -1) {
                const ns = this.engine.systemManager?.nationSystem;
                const nation = ns?.nations.get(village.nationId);
                if (nation && nation.color) colorHex = nation.color;
            }

            // Hex to RGB 변환
            const hex = colorHex.replace('#', '');
            const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16) || 79;
            const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16) || 195;
            const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16) || 247;

            // 1️⃣ 개별 타일 격자 무늬 렌더링
            for (const key of village.territory) {
                const tx = key & 0xFFFF;
                const ty = key >> 16;
                const worldX = tx * TILE_SIZE;
                const worldY = ty * TILE_SIZE;

                // 🚀 카메라 뷰포트 컬링 (화면 밖은 렌더링 스킵)
                if (worldX + TILE_SIZE > camera.x && worldX < camera.x + camera.width / camera.zoom &&
                    worldY + TILE_SIZE > camera.y && worldY < camera.y + camera.height / camera.zoom) {

                    const screenX = (worldX - camera.x) * camera.zoom;
                    const screenY = (worldY - camera.y) * camera.zoom;
                    const size = TILE_SIZE * camera.zoom;

                    // 🚀 타일이 완벽히 블록처럼 보이도록 여백(Gap) 부여
                    const gap = 1.0 * camera.zoom;
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
                    ctx.fillRect(screenX + gap, screenY + gap, size - gap * 2, size - gap * 2);

                    // 타일 격자 선
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
                    ctx.lineWidth = 1 * camera.zoom;
                    ctx.strokeRect(screenX + gap, screenY + gap, size - gap * 2, size - gap * 2);
                }
            }

            // 2️⃣ 외곽선 울타리(Fence) 모양 프로시저럴 렌더링
            ctx.strokeStyle = '#5D4037'; // 나무 기둥 색상 (짙은 갈색)
            ctx.lineWidth = 4 * camera.zoom;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (const key of village.territory) {
                const tx = key & 0xFFFF;
                const ty = key >> 16;
                const worldX = tx * TILE_SIZE;
                const worldY = ty * TILE_SIZE;

                // 화면 밖 무시
                if (worldX + TILE_SIZE < camera.x || worldX > camera.x + camera.width / camera.zoom ||
                    worldY + TILE_SIZE < camera.y || worldY > camera.y + camera.height / camera.zoom) {
                    continue;
                }

                const sX = (worldX - camera.x) * camera.zoom;
                const sY = (worldY - camera.y) * camera.zoom;
                const size = TILE_SIZE * camera.zoom;

                // 모서리에 기둥(말뚝)을 박으며 울타리를 그리는 헬퍼 함수
                const drawFence = (x1, y1, x2, y2) => {
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();

                    ctx.fillStyle = '#3E2723'; // 더 어두운 말뚝 색상
                    ctx.beginPath();
                    ctx.arc(x1, y1, 2.5 * camera.zoom, 0, Math.PI * 2);
                    ctx.arc(x2, y2, 2.5 * camera.zoom, 0, Math.PI * 2);
                    ctx.fill();
                };

                // 인접 타일이 없는 방향(=외곽선)에만 울타리를 칩니다.
                if (!village.territory.has(( (ty - 1) << 16) | tx)) drawFence(sX, sY, sX + size, sY); // 상
                if (!village.territory.has(( (ty + 1) << 16) | tx)) drawFence(sX, sY + size, sX + size, sY + size); // 하
                if (!village.territory.has((ty << 16) | (tx - 1))) drawFence(sX, sY, sX, sY + size); // 좌
                if (!village.territory.has((ty << 16) | (tx + 1))) drawFence(sX + size, sY, sX + size, sY + size); // 우
            }

            // 🏷️ 마을 중심에 라벨(이름 및 타일 수) 렌더링
            const screenCx = (village.centerX - camera.x) * camera.zoom;
            const screenCy = (village.centerY - camera.y) * camera.zoom;

            ctx.fillStyle = '#ffffff';
            ctx.font = `900 ${Math.max(12, 14 * camera.zoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 글자 가독성을 위한 그림자 효과
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 6;
            ctx.fillText(`🏘️ ${village.name}`, screenCx, screenCy - 20 * camera.zoom);

            // 서브 텍스트 (타일 수)
            ctx.font = `bold ${Math.max(10, 11 * camera.zoom)}px sans-serif`;
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillText(`(${village.territory.size} Tiles)`, screenCx, screenCy - 5 * camera.zoom);

            ctx.shadowBlur = 0; // 그림자 초기화
        }
        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ⚡ Task 58: 동적 직업 스케줄링 — 긴급 인력 재배치
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 마을 내 자원/위협 상황에 따라 잉여 인력을 긴급 직업으로 재배치합니다.
     * ChiefRole의 1초 주기 로직과 달리, 15초 주기로 더 강도 높은 재배치를 수행합니다.
     */
    _dynamicJobSchedule(village) {
        if (!village || village.members.size < 3) return;

        const rf = this.engine.systemManager?.humanBehavior?.roleFactory;
        // JobTypes는 생성자 이후 lazy-cache로 로드
        if (!this._jobTypes) return; // 아직 로드 안됨

        const JT = this._jobTypes;
        const res = village.resources || {};
        const pop = village.members.size;

        // 위기 레벨 결정
        const foodCritical  = (res.food  || 0) < pop * 2;   // 1인당 2일분 미만
        const woodCritical  = (res.wood  || 0) < pop * 1.5; // 1인당 1.5단 미만
        const stoneCritical = (res.stone || 0) < 10;

        // 현재 직업 분포 집계
        const distribution = {};
        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const civ = member?.components.get('Civilization');
            if (!civ) continue;
            const jt = civ.jobType || 'unemployed';
            distribution[jt] = (distribution[jt] || 0) + 1;
        }

        // 재배치 후보: IDLE/unemployed 우선, 그 다음 WANDER 중인 비생산 직업
        const reassignableJobs = [JT.UNEMPLOYED, JT.RANCHER, JT.MERCHANT];
        const candidates = [];

        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const civ = member?.components.get('Civilization');
            const state = member?.components.get('AIState');
            if (!civ || !state) continue;
            if (civ.jobType === JT.CHIEF) continue; // 촌장 제외

            const isIdle = state.mode === 'idle' || state.mode === 'wander';
            const isReassignable = reassignableJobs.includes(civ.jobType);
            if (isIdle || isReassignable) candidates.push({ memberId, member, civ });
        }

        if (candidates.length === 0) return;

        let reassigned = 0;
        const MAX_REASSIGN = Math.ceil(candidates.length * 0.5); // 최대 절반까지만 재배치

        const _reassign = (targetJob) => {
            if (reassigned >= MAX_REASSIGN || candidates.length === 0) return;
            const { memberId, member, civ } = candidates.shift();
            const prevJob = civ.jobType;
            civ.jobType = targetJob;
            if (rf) civ.role = rf.createRole(targetJob);
            const jobCtrl = member.components.get('JobController');
            if (jobCtrl && typeof jobCtrl.assignJob === 'function') {
                jobCtrl.assignJob(targetJob);
            }
            GlobalLogger.info(`⚡ [Schedule] Village ${village.id}: ${prevJob} → ${targetJob} (emergency)`);
            reassigned++;
        };

        if (foodCritical)  { _reassign(JT.GATHERER); _reassign(JT.FARMER); }
        if (woodCritical)  { _reassign(JT.LOGGER); }
        if (stoneCritical) { _reassign(JT.MINER); }

        // 남은 무직자는 기본 생산직 배치
        while (candidates.length > 0 && reassigned < MAX_REASSIGN) {
            _reassign(JT.GATHERER);
        }
    }
}
