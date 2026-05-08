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
    }

    decide(entity, dt) {
        this._assignTimer -= dt;
        this._expandTimer -= dt;

        const civ = entity.components.get('Civilization');
        if (!civ || civ.villageId === -1) return null;

        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(civ.villageId);
        if (!village) return null;

        // 🗺️ 0. 마을 영토 지능적 확장 (5초 주기)
        if (this._expandTimer <= 0) {
            this._expandTimer = this._expandInterval;
            this._processTerritoryExpansion(village, vs);
        }

        // 직업/작업 할당은 1초 주기로 실행
        if (this._assignTimer > 0) return null;
        this._assignTimer = this._assignInterval;

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
        const needs = this._analyzeVillageNeeds(village, vs);

        // 📋 2. 마을 할일 목록(TODO List) 갱신
        this._updateVillageTaskBoard(village, needs);

        // ⚙️ 4. 지능적 직업 재배치
        const distribution = this._getJobDistribution(village);
        const quotas = this._getWorkforceQuotas(village);

        for (const memberId of village.members) {
            if (memberId === entity.id) continue;

            const member = this.em.entities.get(memberId);
            if (!member) continue;
            const mCiv = member.components.get('Civilization');
            if (!mCiv) continue;

            const shouldReassign = this._checkReassignmentNeeded(mCiv, needs, distribution, quotas, village, member);

            if (shouldReassign) {
                const oldJob = mCiv.jobType;
                const newJob = this._assignJob(member, needs, distribution, village, quotas);
                if (newJob && oldJob !== newJob) {
                    if (distribution[oldJob] !== undefined) distribution[oldJob]--;
                    distribution[newJob] = (distribution[newJob] || 0) + 1;
                    // GlobalLogger.info는 _assignJob 내부에서 중요한 경우에만 남기도록 변경함
                }
            }
        }

        return null;
    }

    /** 📋 마을 할일 목록(TaskBoard)을 현재 상황에 맞춰 갱신합니다. */
    _updateVillageTaskBoard(village, needs) {
        if (!village.taskBoard) village.taskBoard = [];

        // 1. 완료된 작업 제거 및 유령 작업 해제
        village.taskBoard = village.taskBoard.filter(t => t.status !== 'DONE');

        const urgency = needs.urgency;

        // 2. 건설 과업 추가
        for (const bId of village.buildings) {
            const b = this.em.entities.get(bId);
            const struc = b?.components.get('Structure');
            if (struc && !struc.isComplete) {
                const existing = village.taskBoard.find(t => t.type === 'build' && t.targetId === bId);
                if (!existing) {
                    village.taskBoard.push({
                        id: `build_${bId}`,
                        type: 'build',
                        targetId: bId,
                        zoneId: village.residentialZoneId,
                        priority: struc.type === 'bonfire' || struc.type === 'storage' ? 100 : 60,
                        status: 'AVAILABLE',
                        claimedBy: null
                    });
                }
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
            if (civ) dist[civ.jobType]++;
        }
        return dist;
    }

    _analyzeVillageNeeds(village, vs) {
        const targets = this._getResourceTargets(village);
        const current = village.resources || {};
        
        // 📊 자원별 긴급도 점수 (0 ~ 100)
        // (목표치 - 현재치) / 목표치 * 100
        const woodScore = Math.max(0, Math.min(100, ((targets.wood - (current.wood || 0)) / targets.wood) * 100));
        const foodScore = Math.max(0, Math.min(100, ((targets.food - (current.food || 0)) / targets.food) * 100));
        const stoneScore = Math.max(0, Math.min(100, ((targets.stone - (current.stone || 0)) / targets.stone) * 100));

        const blackboard = this.system.engine?.systemManager?.blackboard;
        const hasAnyBlueprint = blackboard && blackboard.blueprints && blackboard.blueprints.length > 0;
        const isConstructing = (village.plan && village.plan.length > 0) || hasAnyBlueprint;

        const needs = {
            targets,
            urgency: {
                wood: woodScore,
                food: foodScore,
                stone: stoneScore,
                build: isConstructing ? 80 : 0
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

    /** 🏢 마을 건물 인프라에 따른 권장 직업 할당 인원(Quota)을 계산합니다. */
    _getWorkforceQuotas(village) {
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
        quotas[JobTypes.ARCHITECT] = Math.min(5, Math.ceil(village.members.size / 5));

        return quotas;
    }

    /** ⚖️ 각 직업의 현재 우선순위 점수를 계산합니다 (0 ~ 100) */
    _calculateJobPriority(jobType, needs, distribution, village, quotas) {
        let score = 10; // 기본 점수

        const urgency = needs.urgency;
        const pop = village.members.size;
        const currentCount = distribution[jobType] || 0;
        const quota = quotas[jobType] || 0;

        switch (jobType) {
            case JobTypes.ARCHITECT:
                if (needs.isConstructing) {
                    score = urgency.build;
                    // 인원 제한 (쿼터 초과 시 감점)
                    if (currentCount >= quota) score *= 0.5;
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

    _checkReassignmentNeeded(mCiv, needs, distribution, quotas, village, member) {
        const job = mCiv.jobType;
        if (!job || job === JobTypes.UNEMPLOYED) return true;
        
        // ⏱️ [Persistence] 최소 직업 유지 시간 (10초)
        const jobCtrl = member.components.get('JobController');
        if (jobCtrl) {
            const timeSinceSwitch = (Date.now() - jobCtrl.lastJobSwitchTime) / 1000;
            if (timeSinceSwitch < 10) {
                // 아주 긴급한 상황(긴급도 90점 초과)이 아니면 유지
                const urgency = needs.urgency;
                const isCritical = urgency.food > 90 || urgency.wood > 90 || urgency.stone > 90;
                if (!isCritical) return false;
            }
        }

        // 현재 직업의 점수 계산
        const currentScore = this._calculateJobPriority(job, needs, distribution, village, quotas);
        
        // 다른 직업들 중 더 높은 점수가 있는지 확인
        let bestScore = 0;
        for (const type of Object.values(JobTypes)) {
            if (type === JobTypes.CHIEF || type === JobTypes.UNEMPLOYED) continue;
            const score = this._calculateJobPriority(type, needs, distribution, village, quotas);
            if (score > bestScore) bestScore = score;
        }

        // 🛡️ [Anti-Jitter] 전환 임계값: 점수 차이가 20점 이상일 때만 변경
        return (bestScore > currentScore + 20);
    }

    _assignJob(member, needs, distribution, village, quotas) {
        let bestJob = JobTypes.LOGGER;
        let highestScore = -1;

        for (const type of Object.values(JobTypes)) {
            if (type === JobTypes.CHIEF || type === JobTypes.UNEMPLOYED) continue;
            const score = this._calculateJobPriority(type, needs, distribution, village, quotas);
            if (score > highestScore) {
                highestScore = score;
                bestJob = type;
            }
        }

        const mCiv = member.components.get('Civilization');
        if (mCiv) {
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
                const jobLabel = JobTypes[bestJob.toUpperCase()];
                GlobalLogger.info(`👑 [Chief] Reassigned to ${jobLabel} (Priority: ${highestScore.toFixed(1)}) due to urgent village needs.`);
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
}
