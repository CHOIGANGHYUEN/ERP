import System from '../../core/System.js';
import { JobTypes } from '../../config/JobTypes.js';
import { VillageTypes } from '../../config/VillageTypes.js';
import { GlobalLogger } from '../../utils/Logger.js';
import FactoryProvider from '../../factories/core/FactoryProvider.js';

// 🚀 [SOLID] Sub-Systems
import VillageRecruitmentSystem from './village_modules/VillageRecruitmentSystem.js';
import VillagePlanningSystem from './village_modules/VillagePlanningSystem.js';
import VillageEconomySystem from './village_modules/VillageEconomySystem.js';
import VillageJobManager from './village_modules/jobs/VillageJobManager.js';
import VillageTerritoryManager from './village_modules/VillageTerritoryManager.js';
import ResourceTransaction from './village_modules/economy/ResourceTransaction.js';
import LogisticsMediator from './village_modules/economy/LogisticsMediator.js';

/**
 * 🏘️ VillageSystem (Facade / Orchestrator)
 * 마을 시스템의 중심이며, 데이터 관리와 하위 전문 시스템들(Recruitment, Planning, Economy, Jobs)을 조율합니다.
 * 리팩토링을 통해 SRP(단일 책임 원칙)를 준수하며 코드 응집도를 높였습니다.
 */
export default class VillageSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.villages = new Map();
        this.nextVillageId = 1;
        this.dirtyVillages = new Set();

        // 🚀 [SOLID] 하위 시스템 참조 (SystemManager에 의해 주입됨)
        this.recruitmentSystem = null;
        this.planningSystem = null;
        this.economySystem = null;
        this.jobManager = new VillageJobManager(entityManager, engine);
        this.territoryManager = new VillageTerritoryManager(entityManager, engine);
        this.resourceTransaction = new ResourceTransaction(entityManager, engine);
        this.logisticsMediator = new LogisticsMediator(entityManager, engine);

        // 📡 Listen for events (핵심 생성 이벤트는 여기서 관리)
        this.eventBus.on('CREATE_VILLAGE', (payload) => this.createVillage(payload));
    }

    /** 🚀 [Expert Dependency Injection] 서브 시스템 주입 */
    setSubSystems(recruitment, planning, economy) {
        this.recruitmentSystem = recruitment;
        this.planningSystem = planning;
        this.economySystem = economy;
    }

    /** 🏗️ [Planning Delegate] External access to blueprint creation */
    createBlueprint(type, x, y, villageId) {
        return this.planningSystem?.createBlueprint(type, x, y, villageId);
    }

    /** 💰 [Economy Delegate] External access to resource synchronization */
    syncResources(village) {
        return this.economySystem?.syncResources(village);
    }

    update(dt, time) {
        // 🚩 국가 창설 트리거 (마을이 처음 생겼을 때)
        const ns = this.engine.systemManager?.nationSystem;
        if (ns && this.villages.size > 0 && ns.nations.size === 0) {
            const firstVillageId = Array.from(this.villages.keys())[0];
            const nationId = ns.createNation("First Empire", "#f44336");
            ns.addVillageToNation(nationId, firstVillageId);
        }

        // 🚀 [Job Management] 마을별 매크로 직업/과업 상태 업데이트
        this.jobManager.update(dt, this.villages);
        this.logisticsMediator.update(dt, this.villages);

        // 🚀 [Optimization] Dirty Village Sync (Once per frame)
        if (this.dirtyVillages.size > 0) {
            for (const vid of this.dirtyVillages) {
                const v = this.villages.get(vid);
                if (v && this.economySystem) this.economySystem.syncResources(v);
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
            type: this._determineSpecialization(x, y),
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
            },
            _fenceTimer: 30.0
        };

        // 영토 생성 로직
        this._initTerritory(village, x, y);

        // 색상 및 버퍼 동기화
        this._updateIntColor(village);
        this.villages.set(id, village);
        this._syncTerritoryBuffer(village);

        // 국가 배정
        const ns = this.engine.systemManager?.nationSystem;
        if (ns) {
            if (nationIdOverride === -1) {
                const newNationId = ns.createNation(`Empire ${id}`);
                ns.addVillageToNation(newNationId, id);
            } else {
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

        // 🏗️ [Zone System] 초기 영역 할당
        const zm = this.engine.systemManager?.zoneManager;
        if (zm) {
            village.residentialZoneId = zm.createZone(0, 0, 16, 16, 'residential');
            village.lumberZoneId = zm.createZone(0, 0, 16, 16, 'gathering');
            zm.getZone(village.residentialZoneId).villageId = id;
            zm.getZone(village.lumberZoneId).villageId = id;
            zm.rebalanceVillageZones(id);
        }

        // 🚀 [Expert AI] 마을 중심점 엔티티 생성
        const centerId = this.entityManager.createEntity();
        this.entityManager.addComponent(centerId, FactoryProvider.getComponent('Transform', { x, y }));
        this.entityManager.addComponent(centerId, { villageId: id }, 'VillageCenter');
        village.centerEntityId = centerId;
        this.dirtyVillages.add(id);

        this.eventBus.emit('VILLAGE_FOUNDED', { villageId: id, x, y });
        return id;
    }

    _initTerritory(village, x, y) {
        const startTx = Math.floor(x / 16);
        const startTy = Math.floor(y / 16);
        const tg = this.engine.terrainGen;

        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const tx = startTx + dx, ty = startTy + dy;
                if (tx < 0 || ty < 0 || tx >= (this.engine.mapWidth / 16) || ty >= (this.engine.mapHeight / 16)) continue;

                const key = (ty << 16) | tx;
                let isClaimed = false;
                if (tg && tg.territoryBuffer) {
                    const idx = (ty * 16) * this.engine.mapWidth + (tx * 16);
                    if (tg.territoryBuffer[idx] > 0) isClaimed = true;
                }
                if (!isClaimed) village.territory.add(key);
            }
        }

        while (village.territory.size < 100) {
            const candidates = [];
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const key of village.territory) {
                const tx = key & 0xFFFF, ty = key >> 16;
                for (const [dx, dy] of dirs) {
                    const nx = tx + dx, ny = ty + dy;
                    if (nx < 0 || ny < 0 || nx >= (this.engine.mapWidth / 16) || ny >= (this.engine.mapHeight / 16)) continue;
                    const nKey = (ny << 16) | nx;
                    if (!village.territory.has(nKey)) {
                        if (tg && tg.isLandAt(nx * 16 + 8, ny * 16 + 8)) candidates.push(nKey);
                    }
                }
            }
            if (candidates.length === 0) break;
            village.territory.add(candidates[Math.floor(Math.random() * candidates.length)]);
        }
    }

    _syncTerritoryBuffer(village) {
        const territoryBuffer = this.engine.terrainGen?.territoryBuffer;
        if (!territoryBuffer) return;
        for (const key of village.territory) {
            const tx = key & 0xFFFF, ty = key >> 16;
            for (let dy = 0; dy < 16; dy++) {
                const rowOff = (ty * 16 + dy) * this.engine.mapWidth;
                for (let dx = 0; dx < 16; dx++) {
                    const idx = rowOff + (tx * 16 + dx);
                    if (idx >= 0 && idx < territoryBuffer.length) territoryBuffer[idx] = village.id;
                }
            }
        }
    }

    _determineSpecialization(x, y) {
        const radius = 300;
        const sh = this.engine.spatialHash;
        if (!sh) return VillageTypes.GENERAL;

        const nearbyIds = sh.query(x, y, radius);
        let treeCount = 0, mineralCount = 0, foodCount = 0;

        for (const id of nearbyIds) {
            const ent = this.entityManager.entities.get(id);
            const res = ent?.components.get('Resource');
            if (res) {
                if (res.type === 'tree') treeCount++;
                else if (['stone', 'iron_ore', 'gold_ore'].includes(res.type)) mineralCount++;
                else if (['berry', 'food'].includes(res.type)) foodCount++;
            }
        }

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

    _updateIntColor(village) {
        const c = village.color || '#ffffff';
        const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
        village.intColor = (255 << 24) | (b << 16) | (g << 8) | r;
        village.rgbColor = (r << 16) | (g << 8) | b;
        if (this.engine.terrainGen) this.engine.terrainGen.syncVillageColor(village.id, village.rgbColor);
    }

    getVillage(id) {
        return this.villages.get(id);
    }
}
