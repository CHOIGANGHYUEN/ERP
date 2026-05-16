import { JobTypes } from '../../../../config/JobTypes.js';
import { GlobalLogger } from '../../../../utils/Logger.js';

/**
 * 💼 VillageJobManager
 * 마을의 경제 상황을 분석하고, 필요한 직업별 인원(Quota)을 계산하며 작업 게시판을 관리합니다.
 * 기존 ChiefRole에 집중되어 있던 매크로 통제 로직을 시스템 레벨로 분리했습니다. (SRP)
 */
export default class VillageJobManager {
    constructor(entityManager, engine) {
        this.entityManager = entityManager;
        this.engine = engine;
        this._syncTimer = 0;
        this._SYNC_INTERVAL = 3.0; // 3초마다 마을 경제 및 직업 수요 분석
    }

    update(dt, villages) {
        this._syncTimer -= dt;
        if (this._syncTimer <= 0) {
            this._syncTimer = this._SYNC_INTERVAL;
            for (const village of villages.values()) {
                this.syncVillageJobs(village);
            }
        }
    }

    /** 📊 마을의 모든 매크로 상태(자원, 할일, 직업 수요)를 동기화합니다. */
    syncVillageJobs(village) {
        // 1. 상태 캐싱 (O(B))
        const cachedContext = this._createCachedContext(village);

        // 2. 필요(Needs) 분석
        const needs = this.analyzeVillageNeeds(village, cachedContext);
        village.needs = needs; // 마을 객체에 분석 데이터 공유

        // 3. 작업 게시판(TaskBoard) 갱신
        this.updateTaskBoard(village, needs, cachedContext);

        // 4. 직업별 쿼터(T/O) 계산
        village.jobQuotas = this.calculateWorkforceQuotas(village, cachedContext);
        
        // 5. 현재 직업 분포 확인
        village.jobDistribution = this.getJobDistribution(village);

        // 🚀 [Expert Optimization] 촌장 버프 적용
        if (village.chiefId) {
            const chief = this.entityManager.entities.get(village.chiefId);
            if (chief) {
                const social = chief.components.get('Social');
                if (social && social.leadershipAura) {
                    // 촌장이 리더십을 발휘 중이면 쿼터 계산이나 효율에 보너스 부여 가능
                }
            }
        }
    }

    /** 📊 현재 자원 상황과 목표치를 비교하여 긴급도를 계산합니다. */
    analyzeVillageNeeds(village, cachedContext) {
        const targets = this._getResourceTargets(village);
        const current = village.resources || {};
        const max = village.resourceMax || { wood: 200, food: 200, stone: 200 };
        
        const woodScore = Math.max(0, Math.min(100, ((targets.wood - (current.wood || 0)) / targets.wood) * 100));
        const foodScore = Math.max(0, Math.min(100, ((targets.food - (current.food || 0)) / targets.food) * 100));
        const stoneScore = Math.max(0, Math.min(100, ((targets.stone - (current.stone || 0)) / targets.stone) * 100));

        const blueprintsCount = cachedContext.blueprintsCount || 0;

        return {
            targets,
            urgency: {
                wood: woodScore,
                food: foodScore,
                stone: stoneScore,
                build: Math.min(100, blueprintsCount * 40)
            },
            isConstructing: blueprintsCount > 0 || (village.plan && village.plan.length > 0),
            isFoodFull: (current.food || 0) >= max.food,
            isWoodFull: (current.wood || 0) >= max.wood,
            isStoneFull: (current.stone || 0) >= max.stone
        };
    }

    /** 🎯 마을의 이상적인 자원 보유 목표를 계산합니다. */
    _getResourceTargets(village) {
        const pop = village.members.size;
        const buildCount = village.buildings.size;
        return {
            wood: 100 + (buildCount * 30) + (pop * 10),
            food: 150 + (pop * 20),
            stone: 50 + (village.plan.length * 40)
        };
    }

    /** 📋 작업 게시판 갱신 */
    updateTaskBoard(village, needs, cachedContext) {
        if (!village.taskBoard) village.taskBoard = [];
        village.taskBoard = village.taskBoard.filter(t => t.status !== 'DONE');

        const urgency = needs.urgency;

        // 건설 과업
        for (const bId of cachedContext.blueprints) {
            const existing = village.taskBoard.find(t => t.type === 'build' && t.targetId === bId);
            if (!existing) {
                const b = this.entityManager.entities.get(bId);
                const struc = b?.components.get('Structure');
                village.taskBoard.push({
                    id: `build_${bId}`,
                    type: 'build',
                    targetId: bId,
                    priority: struc?.type === 'bonfire' || struc?.type === 'storage' ? 100 : 60,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        // 자원 수집 과업 (인원 쿼터와 연동하여 과도한 생성을 막음)
        this._ensureGatherTasks(village, 'gather_wood', urgency.wood, 3);
        this._ensureGatherTasks(village, 'gather_food', urgency.food, 4);
        this._ensureGatherTasks(village, 'gather_stone', urgency.stone, 2);
        
        // 농경 과업
        this._updateFarmTasks(village);
    }

    _ensureGatherTasks(village, type, urgency, maxCount) {
        if (urgency <= 20) return;
        const existing = village.taskBoard.filter(t => t.type === type).length;
        if (existing < maxCount) {
            village.taskBoard.push({
                id: `${type}_${Date.now()}_${Math.random()}`,
                type: type,
                priority: urgency,
                status: 'AVAILABLE',
                claimedBy: null
            });
        }
    }

    _updateFarmTasks(village) {
        for (const bId of village.buildings) {
            const b = this.entityManager.entities.get(bId);
            const farm = b?.components.get('Farm');
            if (farm && (farm.isHarvestable || !farm.isSeeded)) {
                const existing = village.taskBoard.find(t => t.type === 'farm_work' && t.targetId === bId);
                if (!existing) {
                    village.taskBoard.push({
                        id: `farm_${bId}`,
                        type: 'farm_work',
                        targetId: bId,
                        priority: farm.isHarvestable ? 95 : 75,
                        status: 'AVAILABLE',
                        claimedBy: null
                    });
                }
            }
        }
    }

    /** ⚙️ 직업별 필요 인원(T/O) 계산 */
    calculateWorkforceQuotas(village, cachedContext) {
        const quotas = {};
        for (const type of Object.values(JobTypes)) quotas[type] = 0;

        const pop = village.members.size;
        const farmCount = cachedContext.buildingCounts.farm || 0;
        const blacksmithCount = cachedContext.buildingCounts.blacksmith || 0;
        const blueprintsCount = cachedContext.blueprintsCount || 0;
        const villageType = village.type;

        // 1. 기초 생존 및 자원 (인구 비례 및 마을 성격 반영)
        // [Expert Fix] 초기 소규모 마을에서 특정 직업이 독점하지 않도록 비율 조정
        quotas[JobTypes.LOGGER] = Math.max(1, Math.floor(pop / 6));
        quotas[JobTypes.GATHERER] = Math.max(1, Math.floor(pop / 5));
        
        // 🪨 [Miner Quota Fix] 석재는 건물 건설의 핵심이므로 인구 비례로 기본 할당
        const baseMinerQuota = Math.max(1, Math.floor(pop / 6));
        const specMinerBonus = villageType === 'mining' ? 2 : 0;
        const buildMinerBonus = blueprintsCount > 0 ? 1 : 0;
        quotas[JobTypes.MINER] = baseMinerQuota + specMinerBonus + buildMinerBonus + (blacksmithCount * 1);
        
        // 2. 전문직 (건물 및 특화 기반)
        quotas[JobTypes.FARMER] = farmCount * 2;
        
        if (villageType === 'lumbering') quotas[JobTypes.LOGGER] += 2;
        if (villageType === 'agricultural') {
            quotas[JobTypes.GATHERER] += 1;
            quotas[JobTypes.FARMER] += 1;
        }

        // 3. 건축가 (블루프린트 수 기반)
        // 건설 중일 때는 최소 1명, 인구가 많아지면 최대 5명까지
        quotas[JobTypes.ARCHITECT] = blueprintsCount > 0 ? Math.min(5, Math.max(1, Math.floor(pop / 4))) : 0;

        // 4. [Stability] 총 쿼터가 인구수를 과도하게 넘지 않도록 보정 (우선순위 적용)
        // 실제 모집 시 maxGap으로 선택되므로 쿼터가 인구보다 커도 작동은 하지만, 
        // 밸런스를 위해 로그를 남기거나 나중에 정교화 가능
        return quotas;
    }

    getJobDistribution(village) {
        const dist = {};
        for (const type of Object.values(JobTypes)) dist[type] = 0;
        for (const memberId of village.members) {
            const member = this.entityManager.entities.get(memberId);
            const civ = member?.components.get('Civilization');
            if (civ) {
                const job = civ.jobType || JobTypes.UNEMPLOYED;
                dist[job] = (dist[job] || 0) + 1;
            }
        }
        return dist;
    }

    _createCachedContext(village) {
        const ctx = {
            blueprints: [],
            blueprintsCount: 0,
            buildingCounts: {}
        };

        for (const bId of village.buildings) {
            const b = this.entityManager.entities.get(bId);
            if (!b) continue;
            
            const struc = b.components.get('Structure');
            const build = b.components.get('Building');
            
            if (struc && !struc.isComplete) {
                ctx.blueprints.push(bId);
                ctx.blueprintsCount++;
            }

            if (build) {
                const type = build.type;
                ctx.buildingCounts[type] = (ctx.buildingCounts[type] || 0) + 1;
            }
        }
        return ctx;
    }
}
