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

        // 📋 2. 마을 할일 목록(TODO List) 갱신
        this._updateVillageTaskBoard(village);

        // 📊 3. 현재 마을 필요(Needs) 분석
        const needs = this._analyzeVillageNeeds(village, vs);

        // ⚙️ 4. 지능적 직업 재배치
        const distribution = this._getJobDistribution(village);

        for (const memberId of village.members) {
            if (memberId === entity.id) continue;

            const member = this.em.entities.get(memberId);
            if (!member) continue;
            const mCiv = member.components.get('Civilization');
            if (!mCiv) continue;

            const shouldReassign = this._checkReassignmentNeeded(mCiv, needs, distribution);

            if (shouldReassign) {
                const oldJob = mCiv.jobType;
                const newJob = this._assignJob(member, needs, distribution, village);
                if (newJob && oldJob !== newJob) {
                    if (distribution[oldJob] !== undefined) distribution[oldJob]--;
                    distribution[newJob] = (distribution[newJob] || 0) + 1;
                    GlobalLogger.info(`👑 Chief re-tasked entity ${memberId}: [${oldJob}] -> [${newJob}]`);
                }
            }
        }

        return null;
    }

    /** 📋 마을 할일 목록(TaskBoard)을 현재 상황에 맞춰 갱신합니다. */
    _updateVillageTaskBoard(village) {
        if (!village.taskBoard) village.taskBoard = [];

        // 1. 완료된 작업 제거 및 유령 작업(죽은 주민이 점유한 작업) 해제
        village.taskBoard = village.taskBoard.filter(t => t.status !== 'DONE');

        for (const task of village.taskBoard) {
            if (task.status === 'CLAIMED' && task.claimedBy) {
                if (!this.em.entities.has(task.claimedBy)) {
                    GlobalLogger.info(`♻️ [Chief] Reclaiming task from deceased entity ${task.claimedBy}`);
                    task.status = 'AVAILABLE';
                    task.claimedBy = null;
                }
            }
        }

        // 2. 건설 과업 추가 (청사진 탐색)
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
                        zoneId: village.residentialZoneId, // 🏗️ 타겟 영역을 거주 구역으로 제한
                        priority: struc.type === 'bonfire' || struc.type === 'storage' ? 100 : 50,
                        status: 'AVAILABLE',
                        claimedBy: null
                    });
                }
            }
        }

        // 3. 자원 수급 과업 추가 (임계치 이하일 때)
        const woodNeed = (village.resourceNeeds?.wood || 20) + 50;
        if (village.resources.wood < woodNeed) {
            // 🪵 자원 채집 영역(Gathering Zone) 내의 나무 자원 타겟만 제한하여 확인
            let droppedWoodCount = 0;
            const zm = this.engine.systemManager?.zoneManager;
            const gatherZone = zm?.getZone(village.lumberZoneId);

            if (gatherZone && gatherZone.bounds && this.engine.spatialHash) {
                const b = gatherZone.bounds;
                const nearbyIds = this.engine.spatialHash.queryRect(b.minX, b.minY, b.width, b.height);
                for (const resId of nearbyIds) {
                    const ent = this.em.entities.get(resId);
                    const item = ent?.components.get('DroppedItem');
                    // 🏘️ [Ownership] 자국 소유거나 무소속인 아이템만 카운트
                    if (item && item.itemType === 'wood' && (item.villageId === -1 || item.villageId === village.id)) {
                        droppedWoodCount += (item.amount || 1);
                    }
                }
            }

            const existingGather = village.taskBoard.filter(t => t.type === 'gather_wood').length;
            const existingPickup = village.taskBoard.filter(t => t.type === 'pickup_wood').length;

            // A. 바닥에 나무가 많으면 '줍기' 과업 우선 생성
            if (droppedWoodCount >= 5 && existingPickup < 2) {
                village.taskBoard.push({
                    id: `pickup_wood_${Date.now()}`,
                    type: 'pickup_wood',
                    zoneId: village.lumberZoneId, // 타겟 영역 제한
                    priority: 70,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }

            // B. 바닥에 나무가 적을 때만 '벌목' 과업 생성
            if (droppedWoodCount < 10 && existingGather < 3) {
                village.taskBoard.push({
                    id: `gather_wood_${Date.now()}_${Math.random()}`,
                    type: 'gather_wood',
                    zoneId: village.lumberZoneId, // 타겟 영역 제한
                    priority: village.resources.wood < 15 ? 90 : 40, // 🪵 부족할 때 우선순위 대폭 상향
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        const foodNeed = (village.resourceNeeds?.food || 20) + 30;
        if (village.resources.food < foodNeed) {
            // 🍎 자원 채집 영역(Gathering Zone) 내의 식량 타겟만 제한하여 확인
            let droppedFoodCount = 0;
            const zm = this.engine.systemManager?.zoneManager;
            const gatherZone = zm?.getZone(village.lumberZoneId);

            if (gatherZone && gatherZone.bounds && this.engine.spatialHash) {
                const b = gatherZone.bounds;
                const nearbyIds = this.engine.spatialHash.queryRect(b.minX, b.minY, b.width, b.height);
                const edibleTypes = ['food', 'fruit', 'meat', 'berry'];
                for (const resId of nearbyIds) {
                    const ent = this.em.entities.get(resId);
                    const item = ent?.components.get('DroppedItem');
                    // 🏘️ [Ownership] 자국 소유거나 무소속인 아이템만 카운트
                    if (item && edibleTypes.includes(item.itemType) && (item.villageId === -1 || item.villageId === village.id)) {
                        droppedFoodCount += (item.amount || 1);
                    }
                }
            }

            const existingGather = village.taskBoard.filter(t => t.type === 'gather_food' || t.type === 'hunt').length;
            const existingPickup = village.taskBoard.filter(t => t.type === 'pickup_food').length;

            // A. 바닥에 식량이 많으면 '줍기' 과업 우선 생성
            if (droppedFoodCount >= 5 && existingPickup < 2) {
                village.taskBoard.push({
                    id: `pickup_food_${Date.now()}`,
                    type: 'pickup_food',
                    zoneId: village.lumberZoneId, // 타겟 영역 제한
                    priority: 85,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }

            // B. 바닥에 식량이 적을 때만 '채집/사냥' 과업 생성
            if (droppedFoodCount < 10 && existingGather < 4) {
                const type = Math.random() < 0.7 ? 'gather_food' : 'hunt';
                village.taskBoard.push({
                    id: `${type}_${Date.now()}`,
                    type: type,
                    zoneId: village.lumberZoneId, // 타겟 영역 제한
                    priority: village.resources.food < 15 ? 95 : 45, // 🍎 아사 위기 시 최우선순위
                    status: 'AVAILABLE',
                    claimedBy: null
                });
            }
        }

        // 🪨 4. 석재 수급 과업 추가 (주택/건물 건설에 필요할 때)
        const stoneNeed = village.resourceNeeds?.stone || 0;
        if (village.resources.stone < stoneNeed + 30) {
            const existingGather = village.taskBoard.filter(t => t.type === 'gather_stone').length;
            if (existingGather < 2) {
                village.taskBoard.push({
                    id: `gather_stone_${Date.now()}`,
                    type: 'gather_stone',
                    priority: village.resources.stone < 5 ? 85 : 40,
                    status: 'AVAILABLE',
                    claimedBy: null
                });
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
        let dynamicWoodNeed = village.resourceNeeds?.wood || 10;
        let dynamicFoodNeed = village.resourceNeeds?.food || 15;
        let dynamicStoneNeed = village.resourceNeeds?.stone || 0;

        const blackboard = this.system.engine?.systemManager?.blackboard;
        const hasAnyBlueprint = blackboard && blackboard.blueprints && blackboard.blueprints.length > 0;

        if (village.plan.length > 0 || (village.currentTask && village.currentTask.type === 'build') || hasAnyBlueprint) {
            dynamicWoodNeed += 80;
            dynamicStoneNeed += 40;
        }

        const pop = village.members.size;
        dynamicFoodNeed += pop * 10;

        const needs = {
            canBuild: (village.currentTask && village.currentTask.type === 'build') || hasAnyBlueprint,
            needFood: (village.resources?.food || 0) < dynamicFoodNeed,
            needWood: (village.resources?.wood || 0) < dynamicWoodNeed,
            needStone: (village.resources?.stone || 0) < dynamicStoneNeed,
            isFoodFull: (village.resources?.food || 0) >= (village.resourceMax?.food || 100),
            isWoodFull: (village.resources?.wood || 0) >= (village.resourceMax?.wood || 100),
            isStoneFull: (village.resources?.stone || 0) >= (village.resourceMax?.stone || 100)
        };
        return needs;
    }

    _checkReassignmentNeeded(mCiv, needs, distribution) {
        const job = mCiv.jobType;
        if (!job || job === JobTypes.UNEMPLOYED) return true;
        
        if (job === JobTypes.ARCHITECT && (!needs.canBuild || distribution[JobTypes.ARCHITECT] > 5)) return true;
        if (job === JobTypes.LOGGER && needs.isWoodFull) return true;
        if (job === JobTypes.MINER && needs.isStoneFull) return true;
        if ((job === JobTypes.GATHERER || job === JobTypes.HUNTER) && needs.isFoodFull) return true;
        
        // 위급 상황 시 재배치
        if (needs.needFood && (job === JobTypes.LOGGER || job === JobTypes.MINER) && distribution[job] > 1) return true;
        
        return false;
    }

    _assignJob(member, needs, distribution, village) {
        let job = JobTypes.LOGGER;
        const board = village.taskBoard || [];
        const pop = village.members.size;
        
        // 🏗️ [Scale Fix] 인구에 따라 건축가 최대 수 조정 (최대 5명)
        const maxArchitects = Math.min(5, Math.ceil(pop / 5));
        
        const hasBuildTask = board.some(t => t.type === 'build' && t.status === 'AVAILABLE');
        const hasWoodTask = board.some(t => t.type === 'gather_wood' && t.status === 'AVAILABLE');
        const hasFoodTask = board.some(t => (t.type === 'gather_food' || t.type === 'hunt') && t.status === 'AVAILABLE');
        const hasStoneTask = board.some(t => t.type === 'gather_stone' && t.status === 'AVAILABLE');

        if (hasBuildTask && (distribution[JobTypes.ARCHITECT] || 0) < maxArchitects) {
            job = JobTypes.ARCHITECT;
        } else if (hasFoodTask && (distribution[JobTypes.GATHERER] || 0) < Math.ceil(pop / 3)) {
            job = Math.random() < 0.7 ? JobTypes.GATHERER : JobTypes.HUNTER;
        } else if (hasStoneTask && (distribution[JobTypes.MINER] || 0) < 2) {
            job = JobTypes.MINER;
        } else if (hasWoodTask) {
            job = JobTypes.LOGGER;
        } else if (needs.needFood && !needs.isFoodFull) {
            job = Math.random() < 0.5 ? JobTypes.GATHERER : JobTypes.HUNTER;
        } else if (needs.needWood && !needs.isWoodFull) {
            job = JobTypes.LOGGER;
        } else if (needs.needStone && !needs.isStoneFull) {
            job = JobTypes.MINER;
        } else {
            const rand = Math.random();
            if (rand < 0.3) job = JobTypes.LOGGER;
            else if (rand < 0.6) job = JobTypes.GATHERER;
            else if (rand < 0.8) job = JobTypes.MINER;
            else job = JobTypes.HUNTER;
        }

        const mCiv = member.components.get('Civilization');
        if (mCiv) {
            mCiv.jobType = job;
            const roleFactory = this.system.roleFactory || this.engine.systemManager?.humanBehavior?.roleFactory;
            if (roleFactory) {
                mCiv.role = roleFactory.createRole(job);
            }

            // 🧠 [AI Sync] JobController가 있다면 즉시 직업 변경 통보
            const jobCtrl = member.components.get('JobController');
            if (jobCtrl) {
                jobCtrl.assignJob(job);
            }
        }
        return job;
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
