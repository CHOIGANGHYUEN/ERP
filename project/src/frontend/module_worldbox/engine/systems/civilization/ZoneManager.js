import ZoneData from '../../world/zones/ZoneData.js';
import { GlobalLogger } from '../../utils/Logger.js';

export default class ZoneManager {
    constructor(engine) {
        this.engine = engine;
        this.eventBus = engine.eventBus;
        this.zones = new Map();
        this.nextZoneId = 1;
        this.tileToZoneMap = new Map(); // 🚀 [Optimization] key: "tx,ty", value: zoneId

        // 🗺️ [Zone System] 구역 내 일거리/자원 고갈 시 작업자 재배치 처리
        if (this.eventBus) {
            this.eventBus.on('ZONE_RESOURCE_EXHAUSTED', this.handleZoneExhausted.bind(this));
        }

        this._updateTimer = 0;
    }

    update(dt) {
        this._updateTimer += dt;
        if (this._updateTimer < 5.0) return; // 5초마다 한 번씩 영토 확장 체크
        this._updateTimer = 0;

        const vs = this.engine.systemManager?.villageSystem;
        if (!vs) return;

        for (const village of vs.villages.values()) {
            this._calculateVillageSynergy(village);
            this._processVillageExpansion(village, dt);
        }
    }

    /** 🏰 [Synergy] 마을 내 건물들의 특수 효과(영토 영향력, 방어력)를 합산합니다. */
    _calculateVillageSynergy(village) {
        let totalInfluence = 0;
        let totalDefense = 0;

        for (const buildingId of village.buildings || []) {
            const ent = this.engine.entityManager.entities.get(buildingId);
            const structure = ent?.components.get('Structure');
            if (structure && structure.isComplete) {
                totalInfluence += structure.influence || 0;
                totalDefense += structure.defense || 0;
            }
        }

        village.totalInfluence = totalInfluence;
        village.totalDefense = totalDefense;
    }

    /** 📈 [Expansion] 마을의 문화와 인구에 비례하여 영토를 확장합니다. */
    _processVillageExpansion(village, dt) {
        const ns = this.engine.systemManager?.nationSystem;
        const nation = ns?.nations.get(village.nationId);

        // 확장 강도 계산: 인구 + 국가 문화/기술 보너스 + 🏰 건물 영향력
        const popFactor = Math.sqrt(village.members.size) * 0.5;
        const cultureFactor = (nation?.culture || 0) * 0.1;
        const policyFactor = village.cultureRate || 1.0;
        const buildingFactor = (village.totalInfluence || 0) * 0.2;

        const expansionStrength = (popFactor + cultureFactor + buildingFactor) * policyFactor;

        // 주거 구역과 벌목 구역 각각 확장 시도
        this._attemptExpansion(village.id, village.residentialZoneId, expansionStrength);
        this._attemptExpansion(village.id, village.lumberZoneId, expansionStrength * 0.8);
    }

    _attemptExpansion(villageId, zoneId, strength) {
        const zone = this.zones.get(zoneId);
        if (!zone || !zone.territory || zone.territory.size === 0) return;

        zone.growthPool += strength;

        // 임계값 도달 시 확장 (영토가 넓어질수록 더 많은 에너지가 필요함)
        const threshold = 10 + (zone.territory.size * 0.5);
        if (zone.growthPool >= threshold) {
            zone.growthPool = 0;
            this._expandOneTile(villageId, zoneId, strength);
        }
    }

    _expandOneTile(villageId, zoneId, strength = 0) {
        const zone = this.zones.get(zoneId);
        const vs = this.engine.systemManager?.villageSystem;
        const ns = this.engine.systemManager?.nationSystem;
        const village = vs?.getVillage(villageId);
        if (!zone || !village) return;

        // 인접한 빈 타일 탐색
        const candidates = [];
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
        const tg = this.engine.terrainGen;

        for (const key of zone.territory) {
            const tx = key & 0xFFFF;
            const ty = key >> 16;
            for (const [dx, dy] of dirs) {
                const nx = tx + dx, ny = ty + dy;
                const nKey = (ny << 16) | nx;

                // 1. 맵 경계 체크
                if (nx < 0 || nx >= this.engine.mapWidth / 16 || ny < 0 || ny >= this.engine.mapHeight / 16) continue;

                // 2. 이미 점유된 타일인 경우 처리 (Conflict Logic)
                const tg = this.engine.terrainGen;
                const territoryBuffer = tg?.territoryBuffer;
                const idx = (ny * 16 + 8) * this.engine.mapWidth + (nx * 16 + 8); // 타일 중앙 기준 인덱스
                const currentOwnerId = territoryBuffer ? territoryBuffer[idx] : 0;

                if (currentOwnerId > 0) {
                    if (currentOwnerId === villageId) continue; // 내 타일이면 패스

                    // 타지마을 타일인 경우: 내 확장 강도가 상대의 방어력보다 월등히 높아야 탈취 가능
                    const otherVillage = vs.getVillage(currentOwnerId);
                    if (otherVillage) {
                        const myStrength = strength;
                        const otherDefense = (Math.sqrt(otherVillage.members.size) * 0.5) + 
                                           ((ns?.getNation(otherVillage.nationId)?.culture || 0) * 0.1) +
                                           (otherVillage.totalDefense || 0);

                        // ⚔️ 탈취 시도 (2배 이상 강력할 때)
                        if (myStrength > otherDefense * 2.0) {
                            candidates.push({ nx, ny, nKey, isConflict: true, oldOwner: currentOwnerId });
                        }
                    }
                    continue;
                }

                // 3. 지형 확인 (땅이어야 함)
                if (tg && !tg.isLandAt(nx * 16 + 8, ny * 16 + 8)) continue;

                candidates.push({ nx, ny, nKey });
            }
        }

        if (candidates.length > 0) {
            // 랜덤하게 하나 선택하여 확장 (탈취 타겟이 있으면 우선순위 고려 가능하지만 여기서는 랜덤)
            const pick = candidates[Math.floor(Math.random() * candidates.length)];

            if (pick.isConflict) {
                // 기존 소유자로부터 제거
                const oldVillage = vs.getVillage(pick.oldOwner);
                if (oldVillage) {
                    oldVillage.territory.delete(pick.nKey);
                    // 기존 구역에서도 제거 (모든 구역 탐색)
                    for (const zone of this.zones.values()) {
                        if (zone.villageId === pick.oldOwner) {
                            this.removeTileFromZone(zone.id, pick.nx, pick.ny);
                        }
                    }
                }
                GlobalLogger.warn(`⚔️ Border Conflict: Village ${villageId} captured tile (${pick.nx}, ${pick.ny}) from Village ${pick.oldOwner}`);
            }

            // 마을 영토에 추가
            const claimed = vs.territoryManager
                ? vs.territoryManager.claimTile(villageId, pick.nx, pick.ny)
                : false;
            if (!claimed) return;

            // 구역에 추가
            this.syncVillageZone(zoneId);

            // 🎨 [Sync] TerrainGen 버퍼 동기화
            const territoryBuffer = this.engine.terrainGen?.territoryBuffer;
            if (territoryBuffer) {
                for (let dy = 0; dy < 16; dy++) {
                    const rowOff = (pick.ny * 16 + dy) * this.engine.mapWidth;
                    for (let dx = 0; dx < 16; dx++) {
                        const idx = rowOff + (pick.nx * 16 + dx);
                        if (idx >= 0 && idx < territoryBuffer.length) {
                            territoryBuffer[idx] = villageId;
                        }
                    }
                }
                // 청크 더럽게 표시하여 리렌더링 유도
                this.engine.chunkManager?.markDirty(pick.nx * 16, pick.ny * 16);
            }

            GlobalLogger.info(`🌍 Territory Expanded: Village ${villageId} claimed tile (${pick.nx}, ${pick.ny})`);
        }
    }

    transferTileToVillage(tileKey, fromVillageId, toVillageId) {
        const vs = this.engine.systemManager?.villageSystem;
        const fromVillage = vs?.getVillage(fromVillageId);
        const toVillage = vs?.getVillage(toVillageId);
        if (!fromVillage || !toVillage || fromVillageId === toVillageId) return false;

        const key = typeof tileKey === 'number'
            ? tileKey
            : (() => {
                const [tx, ty] = String(tileKey).split(',').map(Number);
                return (ty << 16) | tx;
            })();
        const tx = key & 0xFFFF;
        const ty = key >> 16;
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;

        fromVillage.territory?.delete(key);
        fromVillage.territory?.delete(`${tx},${ty}`);
        if (!toVillage.territory) toVillage.territory = new Set();
        toVillage.territory.add(key);

        for (const zone of this.zones.values()) {
            if (zone.villageId !== fromVillageId) continue;
            if (zone.territory?.delete(key) || zone.territory?.delete(`${tx},${ty}`)) {
                if (this.tileToZoneMap.get(key) === zone.id) this.tileToZoneMap.delete(key);
                this.syncVillageZone(zone.id);
            }
        }

        const targetZoneId = toVillage.lumberZoneId || toVillage.residentialZoneId;
        if (targetZoneId) {
            this.addTileToZone(targetZoneId, tx, ty);
            this.syncVillageZone(targetZoneId);
        }

        this._paintTerritoryBufferTile(tx, ty, toVillageId);
        this.engine.chunkManager?.markDirty(tx * 16, ty * 16);
        this.eventBus?.emit('TERRITORY_TRANSFERRED', {
            tileKey: key,
            fromVillageId,
            toVillageId,
            tx,
            ty
        });
        return true;
    }

    _paintTerritoryBufferTile(tx, ty, villageId) {
        const territoryBuffer = this.engine.terrainGen?.territoryBuffer;
        if (!territoryBuffer) return;
        for (let dy = 0; dy < 16; dy++) {
            const rowOff = (ty * 16 + dy) * this.engine.mapWidth;
            for (let dx = 0; dx < 16; dx++) {
                const idx = rowOff + (tx * 16 + dx);
                if (idx >= 0 && idx < territoryBuffer.length) {
                    territoryBuffer[idx] = villageId;
                }
            }
        }
    }

    createZone(x, y, width, height, type) {
        const id = `zone_${this.nextZoneId++}`;
        const zone = new ZoneData(id, type, x, y, width, height);
        this.zones.set(id, zone);
        return id;
    }

    /**
     * 🗺️ [Irregular Zone] 마을의 불규칙한 타일 영토를 기반으로 하는 구역을 생성합니다.
     * 촌장(Chief) AI가 마을 영역을 확장한 뒤 syncVillageZone을 호출하여 크기를 동기화해야 합니다.
     */
    createVillageZone(villageId, type) {
        const id = `zone_${this.nextZoneId++}`;
        const zone = new ZoneData(id, type, 0, 0, 16, 16);
        zone.villageId = villageId;
        this.zones.set(id, zone);
        this.syncVillageZone(id);
        return id;
    }

    /**
     * 🔄 촌장이 마을 영토(타일)를 확장했을 때, 구역의 AABB 바운딩 박스를 갱신합니다.
     */
    syncVillageZone(zoneId) {
        const zone = this.zones.get(zoneId);
        if (!zone || zone.villageId === undefined) return;

        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(zone.villageId);
        if (village && zone.territory && zone.territory.size > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const key of zone.territory) {
                const tx = key & 0xFFFF;
                const ty = key >> 16;
                const x = tx * 16;
                const y = ty * 16;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x + 16 > maxX) maxX = x + 16;
                if (y + 16 > maxY) maxY = y + 16;

                // 🚀 [Map Sync]
                this.tileToZoneMap.set(key, zoneId);
            }
            if (zone.bounds) {
                zone.bounds.minX = minX;
                zone.bounds.minY = minY;
                zone.bounds.maxX = maxX;
                zone.bounds.maxY = maxY;
                zone.bounds.width = maxX - minX;
                zone.bounds.height = maxY - minY;
            } else {
                zone.bounds = { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
            }
            zone.x = minX;
            zone.y = minY;
            zone.width = maxX - minX;
            zone.height = maxY - minY;
        }
    }

    /** 🗺️ 특정 타일을 구역에 추가합니다. (중첩 방지 포함) */
    addTileToZone(zoneId, tx, ty) {
        const targetZone = this.zones.get(zoneId);

        if (!targetZone) return;

        const key = (ty << 16) | tx;

        // 🚀 [O(1) Strict Overlap Check] 이미 다른 구역이 이 타일을 점유하고 있는지 확인
        const existingZoneId = this.tileToZoneMap.get(key);
        if (existingZoneId && existingZoneId !== zoneId) {
            const other = this.zones.get(existingZoneId);
            if (other) {
                // 타지마을 구역이라면 추가 실패
                if (other.villageId !== undefined && other.villageId !== targetZone.villageId) {
                    GlobalLogger.warn(`🚫 Zone Overlap Blocked: Tile ${key} is already claimed by Zone ${other.id} of Village ${other.villageId}`);
                    return;
                }
                // 같은 마을의 다른 구역이라면 기존 구역에서 제거
                other.territory.delete(key);
                this.syncVillageZone(other.id);
            }
        }

        targetZone.territory.add(key);
        this.tileToZoneMap.set(key, zoneId);

        // 경계 업데이트
        targetZone.bounds.minX = Math.min(targetZone.bounds.minX, tx * 16);
        targetZone.bounds.minY = Math.min(targetZone.bounds.minY, ty * 16);
        targetZone.bounds.maxX = Math.max(targetZone.bounds.maxX, (tx + 1) * 16);
        targetZone.bounds.maxY = Math.max(targetZone.bounds.maxY, (ty + 1) * 16);
    }

    /** 🗺️ [Modification] 구역에서 타일을 제거합니다. */
    removeTileFromZone(zoneId, tx, ty) {
        const zone = this.zones.get(zoneId);
        if (!zone) return;
        const key = (ty << 16) | tx;
        if (zone.territory.delete(key)) {
            this.tileToZoneMap.delete(key);
            // 경계 재계산은 비용이 크므로 다음 밸런싱 때 처리하거나 대략적으로 유지
        }
    }

    /**
     * ⚖️ [Dynamic Balancing] 마을 내 구역 영역을 지능적으로 재조정합니다.
     * 거주 구역은 마을 중심으로, 채집 구역은 외곽/자원 밀집 지역으로 이동시킵니다.
     */
    rebalanceVillageZones(villageId) {
        const vs = this.engine.systemManager?.villageSystem;
        const village = vs?.getVillage(villageId);
        if (!village || !village.territory) return;

        const resZone = this.zones.get(village.residentialZoneId);
        const gatherZone = this.zones.get(village.lumberZoneId);
        if (!resZone || !gatherZone) return;

        // 모든 타일을 일단 해제하고 평가 후 재배치
        const allTiles = Array.from(village.territory);
        const resSet = new Set();
        const gatherSet = new Set();

        const vTx = Math.floor(village.centerX / 16);
        const vTy = Math.floor(village.centerY / 16);

        for (const key of allTiles) {
            const tx = key & 0xFFFF;
            const ty = key >> 16;
            const distSq = (tx - vTx) ** 2 + (ty - vTy) ** 2;

            // 1. 마을 중심에서 가까운 타일(반경 4타일 이내)은 무조건 주거 구역
            if (distSq <= 16) {
                resSet.add(key);
                continue;
            }

            // 2. 외곽 타일은 자원 밀도 평가
            let resourceScore = 0;
            if (this.engine.spatialHash) {
                const wx = tx * 16 + 8;
                const wy = ty * 16 + 8;
                const nearby = this.engine.spatialHash.query(wx, wy, 24);
                for (const id of nearby) {
                    const ent = this.engine.entityManager.entities.get(id);
                    if (ent && (ent.components.has('Resource') || ent.components.has('Nature'))) resourceScore += 5;
                }
            }

            // 자원이 많으면 채집 구역, 아니면 주거 구역 (중심에서 멀어질수록 채집 구역 선호)
            if (resourceScore > 5 || distSq > 64) {
                gatherSet.add(key);
            } else {
                resSet.add(key);
            }
        }

        // 🚀 [Stability] 구역이 완전히 비지 않도록 최소 타일 보장
        if (resSet.size === 0 && allTiles.length > 0) resSet.add(allTiles[0]);
        if (gatherSet.size === 0 && allTiles.length > 1) gatherSet.add(allTiles[1]);

        resZone.territory = resSet;
        gatherZone.territory = gatherSet;

        this.syncVillageZone(resZone.id);
        this.syncVillageZone(gatherZone.id);
    }

    /** 구역에 작업자를 안전하게 할당합니다. */
    assignWorker(zoneId, entityId) {
        const zone = this.zones.get(zoneId);
        if (!zone) return false;

        if (!zone.assignedWorkers) zone.assignedWorkers = new Set();
        zone.assignedWorkers.add(entityId);

        const entity = this.engine.entityManager.entities.get(entityId);
        if (entity) {
            const jobCtrl = entity.components.get('JobController');
            if (jobCtrl) jobCtrl.zoneId = zoneId;
        }
        return true;
    }

    /** 구역에서 작업자를 해제하고 구속을 풉니다. */
    unassignWorker(zoneId, entityId) {
        const zone = this.zones.get(zoneId);
        if (!zone) return;

        if (zone.assignedWorkers) zone.assignedWorkers.delete(entityId);

        const entity = this.engine.entityManager.entities.get(entityId);
        if (entity) {
            const jobCtrl = entity.components.get('JobController');
            if (jobCtrl && jobCtrl.zoneId === zoneId) {
                jobCtrl.zoneId = null;
            }
        }
    }

    handleZoneExhausted({ entityId, zoneId }) {
        // ⚠️ 구역 내 일거리가 떨어지면 해당 작업자를 구역에서 해제하여 자유롭게 다른 일을 찾도록 함
        this.unassignWorker(zoneId, entityId);

        const zone = this.zones.get(zoneId);
        if (zone && zone.assignedWorkers && zone.assignedWorkers.size === 0) {
            // 모든 작업자가 떠나면 구역 자동 해제 여부를 마을 시스템에 알림
            if (this.eventBus) this.eventBus.emit('ZONE_EMPTY', { zoneId });
        }
    }

    removeZone(zoneId) {
        const zone = this.zones.get(zoneId);
        if (zone) {
            // 🚀 [Map Cleanup]
            if (zone.territory) {
                for (const key of zone.territory) {
                    if (this.tileToZoneMap.get(key) === zoneId) {
                        this.tileToZoneMap.delete(key);
                    }
                }
            }

            if (zone.assignedWorkers) {
                for (const workerId of [...zone.assignedWorkers]) {
                    this.unassignWorker(zoneId, workerId);
                }
            }
            this.zones.delete(zoneId);
        }
    }

    getZone(zoneId) {
        return this.zones.get(zoneId);
    }

    getZoneAt(x, y) {
        const tx = Math.floor(x / 16);
        const ty = Math.floor(y / 16);
        const key = (ty << 16) | tx;

        for (const zone of this.zones.values()) {
            if (zone.territory && zone.territory.size > 0) {
                if (zone.territory.has(key)) return zone;
            } else if (zone.contains(x, y)) {
                return zone;
            }
        }
        return null;
    }

    /**
     * 🖱️ [Zone System] 특정 월드 좌표를 클릭했을 때 구역 정보를 담은 이벤트를 발생시킵니다.
     */
    handleClick(worldX, worldY) {
        // 구역 오버레이가 켜져 있을 때만 동작하도록 제한 (원치 않으시면 조건문 제거 가능)
        const viewFlags = this.engine.viewFlags || {};
        if (!viewFlags.ZONETILE && !viewFlags.showZones) return false;

        const zone = this.getZoneAt(worldX, worldY);
        if (zone) {
            if (this.eventBus) {
                this.eventBus.emit('ZONE_CLICKED', {
                    zoneId: zone.id,
                    type: zone.type,
                    workerCount: zone.assignedWorkers ? zone.assignedWorkers.size : 0,
                    bounds: zone.bounds
                });
            }
            return true; // 구역이 클릭되었음을 반환
        }
        return false;
    }

    getEntitiesInZone(zoneId) {
        const zone = this.zones.get(zoneId);
        if (!zone) return [];

        const entities = [];
        const vs = this.engine.systemManager?.villageSystem;
        const village = zone.villageId !== undefined ? vs?.getVillage(zone.villageId) : null;
        const isIrregular = village && village.territory;

        // spatialHash를 이용하여 구역 내 엔티티 빠르게 검색
        if (this.engine.spatialHash) {
            const ids = this.engine.spatialHash.queryRect(
                zone.bounds.minX, zone.bounds.minY,
                zone.bounds.width, zone.bounds.height
            );
            for (const id of ids) {
                const entity = this.engine.entityManager.entities.get(id);
                if (entity) {
                    if (isIrregular) {
                        const transform = entity.components.get('Transform');
                        if (transform) {
                            const tx = Math.floor(transform.x / 16);
                            const ty = Math.floor(transform.y / 16);
                            if (village.territory.has((ty << 16) | tx)) {
                                entities.push(entity);
                            }
                        }
                    } else {
                        entities.push(entity);
                    }
                }
            }
        } else {
            // Fallback: 전체 순회
            for (const entity of this.engine.entityManager.entities.values()) {
                const transform = entity.components.get('Transform');
                if (transform) {
                    if (isIrregular) {
                        const tx = Math.floor(transform.x / 16);
                        const ty = Math.floor(transform.y / 16);
                        if (village.territory.has((ty << 16) | tx)) {
                            entities.push(entity);
                        }
                    } else if (zone.contains(transform.x, transform.y)) {
                        entities.push(entity);
                    }
                }
            }
        }
        return entities;
    }

}
