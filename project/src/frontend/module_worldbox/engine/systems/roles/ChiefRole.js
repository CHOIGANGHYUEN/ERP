import BaseRole from './BaseRole.js';
import { JobTypes } from '../../config/JobTypes.js';
import { GlobalLogger } from '../../utils/Logger.js';

/**
 * 👑 ChiefRole
 * 마을 촌장의 두뇌 역할.
 * 마을의 자원 상황과 건설 계획을 실시간으로 분석하여 주민들의 직업을 지능적으로 재배치합니다.
 */
export default class ChiefRole extends BaseRole {
    constructor(system) {
        super(system);
        this._assignTimer = 0;
        this._assignInterval = 1.0; // 1초마다 상황 체크 및 직업 조정
        this._expandTimer = 0;
        this._expandInterval = 5.0; // 5초마다 영토 확장 검토
        this._leadershipTimer = 0;
        this._LEADERSHIP_INTERVAL = 10.0; // 10초마다 지도자 버프 적용
    }

    decide(entity, dt) {
        this._assignTimer -= dt;
        this._expandTimer -= dt;
        this._leadershipTimer -= dt;

        const civ = entity.components.get('Civilization');
        if (!civ || civ.villageId === -1) return null;

        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(civ.villageId);
        if (!village) return null;

        // 🌟 [Task 57] 지도자 아우라: 주민 충성도 및 작업 효율 버프 (10초 주기)
        if (this._leadershipTimer <= 0) {
            this._leadershipTimer = this._LEADERSHIP_INTERVAL;
            this._applyLeadershipAura(entity, village, civ);
        }

        // 🗺️ 0. 마을 영토 지능적 확장 (5초 주기)
        if (this._expandTimer <= 0) {
            this._expandTimer = this._expandInterval;
            this._processTerritoryExpansion(village, vs);
        }

        // 직업/작업 할당은 1초 주기로 실행
        if (this._assignTimer > 0) return null;
        this._assignTimer = this._assignInterval;

        // 🚀 [Critical Optimization] 멤버 루프 진입 전 공통 상태를 1회만 계산하여 공유
        const cachedContext = {
            blueprints: [],
            blueprintsCount: 0,
            hasAvailableBuildTask: false
        };

        // 블루프린트 및 건설 필요성 통합 분석 (O(B))
        for (const bId of village.buildings) {
            const b = this.em.entities.get(bId);
            const s = b?.components.get('Structure');
            if (s && !s.isComplete) {
                cachedContext.blueprints.push(bId);
                cachedContext.blueprintsCount++;
            }
        }
        // 건설 과업 존재 여부 (O(T))
        cachedContext.hasAvailableBuildTask = village.taskBoard?.some(t => t.type === 'build' && t.status === 'AVAILABLE') || false;

        // 🏗️ 1. 마을 계획 관리 (모닥불, 창고 우선 및 인구 기반 주택 확장)
        if (village.plan.length === 0) {
            if (village.buildings.size === 0) {
                village.plan.push('bonfire', 'storage');
            } else {
                // 🏠 주거 용량 체크 및 확장 계획
                const currentPop = village.members.size;
                let totalCapacity = 0;
                for (const bId of village.buildings) {
                    const b = this.em.entities.get(bId);
                    const housing = b?.components.get('Housing');
                    if (housing) totalCapacity += housing.capacity;
                }

                // 여유 공간이 1명 이하이거나 꽉 찼을 때 새 집 계획
                if (currentPop >= totalCapacity - 1 && village.plan.filter(p => p === 'house').length === 0) {
                    village.plan.push('house');
                    GlobalLogger.info(`🏘️ [Chief] Village ${civ.villageId} needs more housing! Planning a new house.`);
                }
            }
        }

        // 📊 3. 현재 마을 필요(Needs) 분석
        const needs = this._analyzeVillageNeeds(village, vs, cachedContext);

        // 📋 2. 마을 할일 목록(TODO List) 갱신
        this._updateVillageTaskBoard(village, needs, cachedContext);

        // ⚙️ 4. 지능적 직업 재배치
        const distribution = this._getJobDistribution(village);
        const quotas = this._getWorkforceQuotas(village, cachedContext);

        for (const memberId of village.members) {
            if (memberId === entity.id) continue;

            const member = this.em.entities.get(memberId);
            if (!member) continue;
            const mCiv = member.components.get('Civilization');
            if (!mCiv) continue;

            const shouldReassign = this._checkReassignmentNeeded(mCiv, needs, distribution, quotas, village, member, cachedContext);

            if (shouldReassign) {
                const oldJob = mCiv.jobType;
                const newJob = this._assignJob(member, needs, distribution, village, quotas, cachedContext);
                if (newJob && oldJob !== newJob) {
                    if (distribution[oldJob] !== undefined) distribution[oldJob]--;
                    distribution[newJob] = (distribution[newJob] || 0) + 1;
                }
            }
        }

        return null;
    }

    /** 📋 마을 할일 목록(TaskBoard)을 현재 상황에 맞춰 갱신합니다. */
    _updateVillageTaskBoard(village, needs, cachedContext = {}) {
        if (!village.taskBoard) village.taskBoard = [];

        // 1. 완료된 작업 제거 및 유령 작업 해제
        village.taskBoard = village.taskBoard.filter(t => t.status !== 'DONE');

        const urgency = needs.urgency;

        // 2. 건설 과업 추가 (캐시된 블루프린트 리스트 활용)
        for (const bId of cachedContext.blueprints || []) {
            const existing = village.taskBoard.find(t => t.type === 'build' && t.targetId === bId);
            if (!existing) {
                const b = this.em.entities.get(bId);
                const struc = b?.components.get('Structure');
                village.taskBoard.push({
                    id: `build_${bId}`,
                    type: 'build',
                    targetId: bId,
                    zoneId: village.residentialZoneId,
                    priority: struc?.type === 'bonfire' || struc?.type === 'storage' ? 100 : 60,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        // 3. 자원 수급 과업 (긴급도 기반)
        if (urgency.wood > 20) {
            const existing = village.taskBoard.filter(t => t.type === 'gather_wood').length;
            if (existing < 3) {
                village.taskBoard.push({
                    id: `gather_wood_${Date.now()}_${Math.random()}`,
                    type: 'gather_wood',
                    zoneId: village.lumberZoneId,
                    priority: urgency.wood,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        if (urgency.food > 20) {
            const existing = village.taskBoard.filter(t => t.type === 'gather_food' || t.type === 'hunt').length;
            if (existing < 4) {
                const type = Math.random() < 0.7 ? 'gather_food' : 'hunt';
                village.taskBoard.push({
                    id: `${type}_${Date.now()}`,
                    type: type,
                    zoneId: village.lumberZoneId,
                    priority: urgency.food,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        if (urgency.stone > 20) {
            const existing = village.taskBoard.filter(t => t.type === 'gather_stone').length;
            if (existing < 2) {
                village.taskBoard.push({
                    id: `gather_stone_${Date.now()}`,
                    type: 'gather_stone',
                    priority: urgency.stone,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        // 🚜 4. 농경 관련 과업 (농부용)
        for (const bId of village.buildings) {
            const b = this.em.entities.get(bId);
            const farm = b?.components.get('Farm');
            if (farm) {
                // 수확 또는 파종이 필요한 농장 과업
                const needsWork = farm.isHarvestable || !farm.isSeeded;
                if (needsWork) {
                    const existing = village.taskBoard.find(t => t.type === 'farm_work' && t.targetId === bId);
                    if (!existing) {
                        village.taskBoard.push({
                            id: `farm_${bId}`,
                            type: 'farm_work',
                            targetId: bId,
                            priority: farm.isHarvestable ? 90 : 70,
                            status: 'AVAILABLE',
                            claimedBy: null
                        });
                    }
                }
            }
        }
    }

    _getJobDistribution(village) {
        const dist = {};
        for (const type of Object.values(JobTypes)) dist[type] = 0;

        for (const memberId of village.members) {
            const member = this.em.entities.get(memberId);
            const civ = member?.components.get('Civilization');
            if (civ) {
                const job = civ.jobType || JobTypes.UNEMPLOYED;
                dist[job] = (dist[job] || 0) + 1;
            }
        }
        return dist;
    }

    _analyzeVillageNeeds(village, vs, cachedContext = {}) {
        const targets = this._getResourceTargets(village);
        const current = village.resources || {};
        
        // 📊 자원별 긴급도 점수 (0 ~ 100)
        const woodScore = Math.max(0, Math.min(100, ((targets.wood - (current.wood || 0)) / targets.wood) * 100));
        const foodScore = Math.max(0, Math.min(100, ((targets.food - (current.food || 0)) / targets.food) * 100));
        const stoneScore = Math.max(0, Math.min(100, ((targets.stone - (current.stone || 0)) / targets.stone) * 100));

        const blueprintsCount = cachedContext.blueprintsCount || 0;
        const isConstructing = (village.plan && village.plan.length > 0) || blueprintsCount > 0;

        const needs = {
            targets,
            urgency: {
                wood: woodScore,
                food: foodScore,
                stone: stoneScore,
                build: Math.min(100, blueprintsCount * 40)
            },
            isConstructing,
            isFoodFull: (current.food || 0) >= (village.resourceMax?.food || 200),
            isWoodFull: (current.wood || 0) >= (village.resourceMax?.wood || 200),
            isStoneFull: (current.stone || 0) >= (village.resourceMax?.stone || 200)
        };

        return needs;
    }

    /** 🎯 마을 인구 및 건물 상황에 따른 이상적인 자원 보유 목표를 계산합니다. */
    _getResourceTargets(village) {
        const pop = village.members.size;
        const buildCount = village.buildings.size;
        
        return {
            wood: 100 + (buildCount * 30) + (pop * 10),
            food: 150 + (pop * 20),
            stone: 50 + (village.plan.length * 40)
        };
    }

    _getWorkforceQuotas(village, cachedContext = {}) {
        const em = this.em;
        const quotas = {};
        for (const type of Object.values(JobTypes)) quotas[type] = 0;

        let farmCount = 0;
        let blacksmithCount = 0;

        for (const bId of village.buildings) {
            const b = em.entities.get(bId);
            const building = b?.components.get('Building');
            if (building) {
                if (building.type === 'farm') farmCount++;
                else if (building.type === 'blacksmith') blacksmithCount++;
            }
        }

        quotas[JobTypes.FARMER] = farmCount * 2; // 농장당 2명
        quotas[JobTypes.MINER] = 1 + (blacksmithCount * 2); // 대장간당 추가 광부
        // 🔨 [ARCHITECT] 건설 과업 수에 따라 동적으로 할당 (인구의 25% ~ 최대 5명)
        const blueprintsCount = cachedContext.blueprintsCount || 0;
        quotas[JobTypes.ARCHITECT] = Math.min(5, Math.max(Math.ceil(village.members.size / 4), blueprintsCount > 0 ? 1 : 0));

        return quotas;
    }

    _calculateJobPriority(jobType, needs, distribution, village, quotas, cachedContext = {}) {
        let score = 10; // 기본 점수

        const urgency = needs.urgency;
        const pop = village.members.size;
        const currentCount = distribution[jobType] || 0;
        const quota = quotas[jobType] || 0;

        switch (jobType) {
            case JobTypes.ARCHITECT:
                // 🔨 [ARCHITECT]
                if (needs.isConstructing) {
                    score = 120 + needs.urgency.build; // 🔨 점수 대폭 상향 (100 -> 120)
                    // 건설 과업이 남아있다면 쿼터 초과 페널티 완화
                    const taskAvailable = cachedContext.hasAvailableBuildTask;
                    if (currentCount >= quota && !taskAvailable) score *= 0.5;
                } else {
                    score = 0;
                }
                break;

            case JobTypes.FARMER:
                if (quota > 0) {
                    score = urgency.food * 1.2;
                    if (currentCount >= quota) score *= 0.3; // 농장은 자리가 한정됨
                } else {
                    score = 0;
                }
                break;

            case JobTypes.GATHERER:
            case JobTypes.HUNTER:
                score = urgency.food;
                // 인구 비례 최소 인원 확보 (농장이 없을 때 중요)
                const minGatherers = Math.ceil(pop / 4);
                if (currentCount < minGatherers) score += 30;
                break;

            case JobTypes.LOGGER:
                score = urgency.wood;
                if (needs.isWoodFull) score = 0;
                break;

            case JobTypes.MINER:
                score = urgency.stone;
                if (currentCount < quota) score += 20; // 대장간 등이 있으면 가점
                if (needs.isStoneFull) score = 0;
                break;
        }

        // 약간의 랜덤성 추가 (유연한 배분)
        return score + (Math.random() * 5);
    }

    _checkReassignmentNeeded(mCiv, needs, distribution, quotas, village, member, cachedContext = {}) {
        const job = mCiv.jobType;
        if (!job || job === JobTypes.UNEMPLOYED) return true;
        if (job === JobTypes.CHIEF) return false; // 👑 촌장은 절대로 다른 직업으로 전직하지 않음

        // ⏱️ [Persistence] 최소 직업 유지 시간 (10초)
        const jobCtrl = member.components.get('JobController');
        if (jobCtrl) {
            const timeSinceSwitch = (Date.now() - jobCtrl.lastJobSwitchTime) / 1000;
            if (timeSinceSwitch < 10) {
                // 아주 긴급한 상황(긴급도 90점 초과)이 아니면 유지
                const urgency = needs.urgency;
                const isCritical = urgency.food > 90 || urgency.wood > 90 || urgency.stone > 90 || urgency.build > 90;
                if (!isCritical) return false;
            }
        }

        // 현재 직업의 점수 계산
        const currentScore = this._calculateJobPriority(job, needs, distribution, village, quotas, cachedContext);
        
        // 다른 직업들 중 더 높은 점수가 있는지 확인
        let bestScore = 0;
        for (const type of Object.values(JobTypes)) {
            if (type === JobTypes.CHIEF || type === JobTypes.UNEMPLOYED) continue;
            const score = this._calculateJobPriority(type, needs, distribution, village, quotas, cachedContext);
            if (score > bestScore) bestScore = score;
        }

        // 🛡️ [Architect Persistence] 건축가는 할일이 남아있으면 웬만하면 유지
        if (job === JobTypes.ARCHITECT && needs.isConstructing) {
            const hasAvailableBuildTask = cachedContext.hasAvailableBuildTask;
            if (hasAvailableBuildTask || (mCiv.role && mCiv.role.targetId)) {
                // 식량 위기(90점 이상)가 아니면 건축 업무 지속
                if (needs.urgency.food < 90) return false;
            }
        }

        // 🛡️ [Anti-Jitter] 전환 임계값: 점수 차이가 25점 이상일 때만 변경 (안정성 강화)
        return (bestScore > currentScore + 25);
    }

    _assignJob(member, needs, distribution, village, quotas, cachedContext = {}) {
        const mCiv = member.components.get('Civilization');
        if (!mCiv) return JobTypes.UNEMPLOYED;
        
        // 👑 이미 촌장이면 그대로 유지
        if (mCiv.jobType === JobTypes.CHIEF) return JobTypes.CHIEF;

        let bestJob = JobTypes.UNEMPLOYED;
        let highestScore = -1;

        for (const type of Object.values(JobTypes)) {
            if (type === JobTypes.CHIEF || type === JobTypes.UNEMPLOYED) continue;
            const score = this._calculateJobPriority(type, needs, distribution, village, quotas, cachedContext);
            if (score > highestScore) {
                highestScore = score;
                bestJob = type;
            }
        }

        if (bestJob !== JobTypes.UNEMPLOYED) {
            const oldJob = mCiv.jobType;
            mCiv.jobType = bestJob;
            
            const roleFactory = this.system.roleFactory || this.engine.systemManager?.humanBehavior?.roleFactory;
            if (roleFactory) {
                mCiv.role = roleFactory.createRole(bestJob);
            }

            const jobCtrl = member.components.get('JobController');
            if (jobCtrl) {
                jobCtrl.assignJob(bestJob);
            }

            // 📢 [Rationale Logging] 중요한 직업 변경 시 로그 남기기
            if (oldJob !== bestJob && highestScore > 70) {
                GlobalLogger.info(`👑 [Chief] Reassigned Entity ${member.id} to ${bestJob} (Priority: ${highestScore.toFixed(1)})`);
            }
        }
        return bestJob;
    }

    // ==========================================
    // 🗺️ [Territory Expansion] 촌장의 영토 확장 지능
    // ==========================================

    _processTerritoryExpansion(village, vs) {
        const TILE_SIZE = 16;
        // 🚀 [Scale Adjustment] 타일 크기가 줄어든 만큼 목표 타일 수를 약 4배 상향 조정
        const targetTiles = 60 + village.members.size * 12 + village.buildings.size * 24;

        // 1. 현재 영토가 이미 목표치에 도달했으면 스킵
        if (!village.territory || village.territory.size >= targetTiles) return;

        // 2. 인접 타일 탐색
        const candidates = this._getAdjacentTiles(village.territory);
        if (candidates.length === 0) return;

        // 3. 타일 평가 및 불규칙 선택 (Irregular Expansion)
        const scoredCandidates = candidates.map(tile => ({
            tile,
            score: this._evaluateTile(tile.tx, tile.ty, TILE_SIZE) + (Math.random() * 5) // 🎲 약간의 랜덤성 추가
        })).filter(c => c.score >= 0);

        if (scoredCandidates.length === 0) return;

        // 점수 순으로 정렬 후 상위 3개 중 하나를 무작위 선택 (불규칙성 확보)
        scoredCandidates.sort((a, b) => b.score - a.score);
        const poolSize = Math.min(3, scoredCandidates.length);
        const choice = scoredCandidates[Math.floor(Math.random() * poolSize)];
        const bestTile = choice.tile;
        const highestScore = choice.score;

        // 4. 병합 조건 충족 시 영토 확장
        if (bestTile && highestScore >= 0) {
            const key = (bestTile.ty << 16) | bestTile.tx;

            // 다른 마을 영토와의 충돌 검사
            let overlap = false;
            for (const other of vs.villages.values()) {
                if (other.id !== village.id && other.territory && other.territory.has(key)) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                village.territory.add(key);
                village.territorySize = village.territory.size; // 🗺️ 영토가 확장될 때 UI용 캐시 값 동기화

                // 🗺️ [Engine Buffer Sync] 영토 버퍼 동기화
                const territoryBuffer = this.engine.terrainGen?.territoryBuffer;
                if (territoryBuffer) {
                    const tx = key & 0xFFFF;
                    const ty = key >> 16;
                    const startX = tx * 16;
                    const startY = ty * 16;
                    for (let dy = 0; dy < 16; dy++) {
                        const rowOff = (startY + dy) * this.engine.mapWidth;
                        const idx = rowOff + startX;
                        if (idx >= 0 && idx + 16 <= territoryBuffer.length) {
                            territoryBuffer.fill(village.id, idx, idx + 16);
                        }
                    }
                }

                if (this.engine.eventBus) {
                    this.engine.eventBus.emit('VILLAGE_EXPANDED', { villageId: village.id, tx: bestTile.tx, ty: bestTile.ty });
                }

                // ⚖️ [Zone System] 영토 확장 후 모든 구역의 균형을 재조정 (중심-외곽 재분배)
                const zm = this.engine.systemManager?.zoneManager;
                if (zm) {
                    zm.rebalanceVillageZones(village.id);
                }
            }
        }
    }

    _getAdjacentTiles(territory) {
        const adjacent = new Map();
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const key of territory) {
            const tx = key & 0xFFFF;
            const ty = key >> 16;
            for (const [dx, dy] of dirs) {
                const nx = tx + dx;
                const ny = ty + dy;
                const nKey = (ny << 16) | nx;
                if (!territory.has(nKey)) {
                    adjacent.set(nKey, { tx: nx, ty: ny });
                }
            }
        }
        return Array.from(adjacent.values());
    }

    _evaluateTile(tx, ty, tileSize) {
        let score = 10;
        const worldX = tx * tileSize + tileSize / 2;
        const worldY = ty * tileSize + tileSize / 2;

        if (worldX < 0 || worldX >= this.engine.mapWidth || worldY < 0 || worldY >= this.engine.mapHeight) return -1;

        // 지형 평가 (물/바다 불가, 산 불가, 비옥도 가점)
        const tg = this.engine.terrainGen;
        if (tg) {
            if (!tg.isLandAt(worldX, worldY)) return -1;
            const idx = tg.getIndex(worldX, worldY);
            if (tg.isMountain(idx)) return -1; // 🏔️ 산에는 영토 확장 불가
            if (tg.fertilityBuffer && tg.fertilityBuffer[idx] > 150) score += 3;
        }

        // 자원 혜택 평가 (SpatialHash 활용)
        if (this.engine.spatialHash) {
            const nearbyIds = this.engine.spatialHash.query(worldX, worldY, tileSize);
            for (const resId of nearbyIds) {
                const ent = this.em.entities.get(resId);
                const res = ent?.components.get('Resource');
                if (res) {
                    if (res.type === 'tree') score += 5;
                    else if (res.type === 'iron_ore' || res.type === 'stone' || res.type === 'ore') score += 10;
                    else if (res.type === 'berry' || res.type === 'food') score += 8;
                }
            }
        }
        return score;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 👑 Task 57: 지도자 아우라 — 충성도 버프 & 외교 기반 직업 조정
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 지도자가 마을 주민들에게 충성도와 작업 효율 버프를 부여합니다.
     * 충성도가 높을수록 더 강한 버프를 발동합니다.
     */
    _applyLeadershipAura(chiefEntity, village, civ) {
        const chiefStats = chiefEntity.components.get('BaseStats');
        const chiefSocial = chiefEntity.components.get('Social');

        // 🎖️ 지도자 자신의 능력치 기반 버프 강도 결정
        const charisma = chiefStats ? Math.min(1.0, (chiefStats.charisma || 50) / 100) : 0.5;
        const currentLoyalty = village.loyalty ?? 70;

        // 1. 마을 충성도 소폭 상승 (지도자가 살아있는 한)
        const loyaltyGain = 0.5 + charisma * 1.5; // 0.5 ~ 2.0 포인트
        village.loyalty = Math.min(100, currentLoyalty + loyaltyGain);

        // 2. 외교 상황에 따른 직업 긴급 재조정
        this._adjustJobsForDiplomacy(village, civ);

        // 3. 주변 주민들에게 작업 효율 버프 (workSpeedBuff 플래그)
        const buffRadius = 150;
        const transform = chiefEntity.components.get('Transform');
        if (!transform || !this.engine.spatialHash) return;

        let buffedCount = 0;
        this.engine.spatialHash.eachInRange(transform.x, transform.y, buffRadius, (id) => {
            if (id === chiefEntity.id) return;
            const ent = this.em.entities.get(id);
            const memberCiv = ent?.components.get('Civilization');
            if (!memberCiv || memberCiv.villageId !== civ.villageId) return;

            const social = ent.components.get('Social');
            if (social) {
                // 충성도 소폭 개인 부여
                social.loyalty = Math.min(100, (social.loyalty || 70) + 0.3);
                // 작업 속도 버프 플래그 (ConstructionSystem, FarmerState 등에서 사용)
                social.workSpeedBuff = 1.0 + charisma * 0.3; // 최대 130%
                social.workSpeedBuffExpiry = Date.now() + (this._LEADERSHIP_INTERVAL * 1200); // 12초간 유효
            }
            buffedCount++;
        });

        if (buffedCount > 0) {
            GlobalLogger.info(`👑 [Chief] Leadership aura buffed ${buffedCount} villagers. Loyalty: ${village.loyalty.toFixed(1)}`);
        }

        // 🎉 시각적 효과 (카리스마 높을 때만)
        if (charisma > 0.6) {
            this.engine.eventBus?.emit('SPAWN_EFFECT_PARTICLES', {
                x: transform.x, y: transform.y - 15,
                count: 5, type: 'EFFECT', color: '#ffd700', speed: 1.5
            });
        }
    }

    /**
     * 마을의 외교 상황(전쟁/평화)에 따라 병사/일반 직업 비율을 긴급 조정합니다.
     */
    _adjustJobsForDiplomacy(village, civ) {
        const ns = this.engine.systemManager?.nationSystem;
        const vs = this.engine.systemManager?.villageSystem;
        if (!ns || !vs) return;

        const nationId = civ.nationId ?? village.nationId ?? -1;
        if (nationId === -1) return;

        const nation = ns.nations?.get(nationId);
        const isAtWar = nation && nation.atWarWith && nation.atWarWith.size > 0;

        // 현재 병사 비율 확인
        const distribution = this._getJobDistribution(village);
        const totalWorkers = village.members.size - 1; // 촌장 제외
        if (totalWorkers <= 0) return;

        const warriorCount = (distribution[JobTypes.WARRIOR] || 0);
        const targetWarriorRatio = isAtWar ? 0.35 : 0.10; // 전쟁 중 35%, 평화 10%
        const targetWarriorCount = Math.floor(totalWorkers * targetWarriorRatio);

        if (isAtWar && warriorCount < targetWarriorCount) {
            // ⚔️ 전쟁 상황: 잉여 인력을 병사로 긴급 전환
            let converted = 0;
            for (const memberId of village.members) {
                if (converted >= targetWarriorCount - warriorCount) break;
                const member = this.em.entities.get(memberId);
                const memberCiv = member?.components.get('Civilization');
                if (!memberCiv || memberCiv.jobType === JobTypes.CHIEF || memberCiv.jobType === JobTypes.WARRIOR) continue;

                // 채집가/벌목꾼 등 대체 가능한 직업만 전환
                if ([JobTypes.GATHERER, JobTypes.LOGGER, JobTypes.UNEMPLOYED].includes(memberCiv.jobType)) {
                    memberCiv.jobType = JobTypes.WARRIOR;
                    const roleFactory = this.system.roleFactory || this.engine.systemManager?.humanBehavior?.roleFactory;
                    if (roleFactory) memberCiv.role = roleFactory.createRole(JobTypes.WARRIOR);
                    const jobCtrl = member.components.get('JobController');
                    if (jobCtrl) jobCtrl.assignJob(JobTypes.WARRIOR);
                    converted++;
                }
            }
            if (converted > 0) {
                GlobalLogger.info(`⚔️ [Chief] WAR FOOTING: Converted ${converted} citizens to Warriors!`);
            }
        } else if (!isAtWar && warriorCount > targetWarriorCount) {
            // 🕊️ 평화 상황: 잉여 병사를 생산직으로 복귀
            let demobilized = 0;
            for (const memberId of village.members) {
                if (demobilized >= warriorCount - targetWarriorCount) break;
                const member = this.em.entities.get(memberId);
                const memberCiv = member?.components.get('Civilization');
                if (!memberCiv || memberCiv.jobType !== JobTypes.WARRIOR) continue;

                memberCiv.jobType = JobTypes.LOGGER; // 기본 생산직으로 복귀
                const roleFactory = this.system.roleFactory || this.engine.systemManager?.humanBehavior?.roleFactory;
                if (roleFactory) memberCiv.role = roleFactory.createRole(JobTypes.LOGGER);
                const jobCtrl = member.components.get('JobController');
                if (jobCtrl) jobCtrl.assignJob(JobTypes.LOGGER);
                demobilized++;
            }
            if (demobilized > 0) {
                GlobalLogger.info(`🕊️ [Chief] PEACETIME: Demobilized ${demobilized} warriors back to production.`);
            }
        }
    }
}
