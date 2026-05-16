import System from '../../core/System.js';
import Pathfinder from '../../utils/Pathfinder.js';
import { GlobalLogger } from '../../utils/Logger.js';

export default class ConstructionSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this._proposeTimer = 0;
        this._PROPOSE_INTERVAL = 5; // 5초마다 건물 제안 평가 (촌장 계획 즉각 반영용)

        // 마을 발전 단계별 건물 로드맵
        this._buildingRoadmap = [
            // 인구 1+ 시작: 모닥불 + 창고 우선
            { minPop: 1, buildingType: 'bonfire', requires: { wood: 5 }, checkFn: (v, em) => !this._hasBuilding(v, em, 'bonfire') },
            { minPop: 2, buildingType: 'storage', requires: { wood: 10 }, checkFn: (v, em) => !this._hasBuilding(v, em, 'storage') },
            // 인구 3+ 초기 정착: 집 건설
            { minPop: 3, buildingType: 'house', requires: { wood: 15, stone: 5 }, checkFn: (v, em) => this._countBuilding(v, em, 'house') < Math.floor(v.members.size / 3) },
            // 인구 5+ 중기: 우물 + 대장간
            { minPop: 5, buildingType: 'well', requires: { stone: 20 }, checkFn: (v, em) => !this._hasBuilding(v, em, 'well') },
            { minPop: 6, buildingType: 'farm', requires: { wood: 20 }, checkFn: (v, em) => this._countBuilding(v, em, 'farm') < Math.ceil(v.members.size / 5) },
            // 인구 8+ 후기: 망루 + 대장간
            { minPop: 8, buildingType: 'watchtower', requires: { stone: 30 }, checkFn: (v, em) => !this._hasBuilding(v, em, 'watchtower') },
            { minPop: 10, buildingType: 'blacksmith', requires: { stone: 25, wood: 10 }, checkFn: (v, em) => !this._hasBuilding(v, em, 'blacksmith') },
        ];
    }

    update(dt, time) {
        const em = this.entityManager;

        // ⏱️ 마을 발전 단계 평가 (주기적)
        this._proposeTimer += dt;
        if (this._proposeTimer >= this._PROPOSE_INTERVAL) {
            this._proposeTimer = 0;
            this._evaluateVillageNeeds();
        }

        // 🚀 [Massive Optimization] 200k 개체 대응을 위해 매 프레임 모든 인간을 순회하던 로직을 제거함.
        // 건설 진행도 업데이트는 이제 BuildState에서 개별적으로 수행됩니다.
    }

    /** 🎊 건물 완성 및 시스템 반영 */
    finalizeBuilding(target, targetId, structure) {
        try {
            structure.progress = structure.maxProgress;
            structure.isComplete = true;
            structure.isBlueprint = false;

            const visual = target.components.get('Visual');
            if (visual) {
                visual.alpha = 1.0;
            }

            GlobalLogger.success(`Building Complete: ${structure.type.toUpperCase()} at (${Math.floor(target.components.get('Transform')?.x || 0)}, ${Math.floor(target.components.get('Transform')?.y || 0)})`);

            const targetPos = target.components.get('Transform');
            if (targetPos) {
                const isRoad = ['road', 'dirt_road', 'stone_road'].includes(structure.type);
                // 1. 지형 및 점유 업데이트 (에러 발생 시 로그만 출력)
                try {
                    if (this.engine.terrainGen) {
                        this.engine.terrainGen.setOccupancy(targetPos.x, targetPos.y, isRoad ? 0 : 2);
                        // 건설 완료 시 해당 자리 비옥도 초기화 (건물 부지)
                        if (!isRoad && typeof this.engine.terrainGen.setFertility === 'function') {
                            this.engine.terrainGen.setFertility(targetPos.x, targetPos.y, 0);
                        }
                    }
                } catch (terrainErr) {
                    console.error("Terrain update failed during building completion:", terrainErr);
                }

                // 2. 🚀 [Optimization] 건설에 참여한 모든 유닛 상태 초기화 (마을 멤버 단위 최적화)
                const vs = this.engine.systemManager?.villageSystem;
                const civ = target.components.get('Civilization');
                const village = vs?.getVillage(civ?.villageId);
                const buildingRadius = (visual?.size || 40) * 0.5 + 10;

                if (village) {
                    for (const id of village.members) {
                        const entity = this.entityManager.entities.get(id);
                        if (!entity) continue;
                        const state = entity.components.get('AIState');
                        if (state && state.targetId === targetId) {
                            state.mode = 'idle';
                            state.targetId = null;
                            state.path = null;

                            const transform = entity.components.get('Transform');
                            if (transform) {
                                let dx = transform.x - targetPos.x;
                                let dy = transform.y - targetPos.y;
                                let d = Math.hypot(dx, dy) || 1;
                                transform.x = targetPos.x + (dx / d) * buildingRadius;
                                transform.y = targetPos.y + (dy / d) * buildingRadius;
                                transform.vx = 0;
                                transform.vy = 0;
                            }
                        }
                    }
                }

                GlobalLogger.success(`✅ Construction Complete: ${structure.type.toUpperCase()}`);
                const civComp = target.components.get('Civilization');
                this.eventBus.emit('BUILDING_COMPLETE', { id: targetId, type: structure.type, villageId: civComp?.villageId });
            }
        } catch (fatalErr) {
            console.error("Fatal error in finalizeBuilding:", fatalErr);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🏙️ 마을 발전 단계별 건물 자동 제안
    // ─────────────────────────────────────────────────────────────────────────

    /** 모든 마을의 발전 상황을 평가하고 건물 청사진을 배치합니다. */
    _evaluateVillageNeeds() {
        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;

        for (const [villageId, village] of vs.villages) {
            if (!village || village.members.size === 0) continue;

            // 1. 현재 건설 중인 미완성 건물 카운트 (Array.from 제거 최적화)
            let pendingCount = 0;
            for (const bId of village.buildings) {
                const b = this.entityManager.entities.get(bId);
                const s = b?.components.get('Structure');
                if (s && !s.isComplete) pendingCount++;
            }
            if (pendingCount >= 3) continue;

            // 2. 촌장의 계획(village.plan) 우선 처리 (ChiefRole에서 세운 계획)
            if (village.plan && village.plan.length > 0) {
                const nextBuildingType = village.plan[0];
                const spawnPos = this._findBuildingSpot(village);
                if (spawnPos) {
                    this.engine.factoryProvider.spawn('building', nextBuildingType, spawnPos.x, spawnPos.y, { isBlueprint: true, villageId });
                    village.plan.shift(); // 계획에서 제거
                    GlobalLogger.info(`🏙️ [Chief Plan] Placing blueprint: ${nextBuildingType} for village ${villageId}`);
                    continue;
                }
            }

            // 3. 로드맵 기반 자동 제안 (촌장 계획이 없을 때만)
            for (const proposal of this._buildingRoadmap) {
                if (village.members.size < proposal.minPop) continue;
                if (!proposal.checkFn(village, this.entityManager)) continue;

                // 자원 여유 확인 (마을 저장소 기준 40% 완화)
                let canAfford = true;
                for (const [res, amount] of Object.entries(proposal.requires)) {
                    if ((village.resources[res] || 0) < Math.ceil(amount * 0.4)) {
                        canAfford = false;
                        break;
                    }
                }
                if (!canAfford) continue;

                const spawnPos = this._findBuildingSpot(village);
                if (spawnPos) {
                    this.engine.factoryProvider.spawn('building', proposal.buildingType, spawnPos.x, spawnPos.y, { isBlueprint: true, villageId });
                    GlobalLogger.info(`🏙️ [Construction] Roadmap Proposing ${proposal.buildingType} for village ${villageId}`);
                    break;
                }
            }
        }
    }

    /** 마을 건물 목록에 특정 타입의 건물이 있는지 확인합니다. */
    _hasBuilding(village, em, type) {
        for (const bId of village.buildings) {
            const b = em.entities.get(bId);
            const s = b?.components.get('Structure');
            if (s && s.type === type) return true;
        }
        return false;
    }

    /** 마을 건물 목록에서 특정 타입의 건물 개수를 반환합니다. */
    _countBuilding(village, em, type) {
        let count = 0;
        for (const bId of village.buildings) {
            const b = em.entities.get(bId);
            const s = b?.components.get('Structure');
            if (s && s.type === type) count++;
        }
        return count;
    }

    /** 마을 중심 근처에서 건물 배치 가능한 위치를 찾습니다. */
    _findBuildingSpot(village) {
        const tg = this.engine.terrainGen;
        const cx = village.centerX || village.x || 0;
        const cy = village.centerY || village.y || 0;

        for (let attempt = 0; attempt < 25; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 100;
            const x = Math.floor(cx + Math.cos(angle) * dist);
            const y = Math.floor(cy + Math.sin(angle) * dist);
            
            if (x < 50 || x > this.engine.mapWidth - 50 || y < 50 || y > this.engine.mapHeight - 50) continue;
            
            if (!tg) return { x, y };
            const idx = tg.getIndex(x, y);
            if (!tg.isWater(idx) && tg.getOccupancy(x, y) === 0) {
                // 건물끼리 너무 붙지 않게 체크
                let tooClose = false;
                const nearby = this.engine.spatialHash?.query(x, y, 35) || [];
                for (const nid of nearby) {
                    if (this.entityManager.entities.get(nid)?.components.has('Building')) {
                        tooClose = true;
                        break;
                    }
                }
                if (!tooClose) return { x, y };
            }
        }
        return null;
    }

}
