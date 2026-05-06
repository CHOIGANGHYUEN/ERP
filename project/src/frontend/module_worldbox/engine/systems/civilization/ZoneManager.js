import ZoneData from '../../world/zones/ZoneData.js';

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
        this.syncVillageZone(zoneId);
    }

    /** 🗺️ 특정 타일을 구역에서 제거합니다. */
    removeTileFromZone(zoneId, tx, ty) {
        const zone = this.zones.get(zoneId);
        if (!zone) return;
        const key = (ty << 16) | tx;
        zone.territory.delete(key);
        if (this.tileToZoneMap.get(key) === zoneId) {
            this.tileToZoneMap.delete(key);
        }
        this.syncVillageZone(zoneId);
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

    /**
     * 🎨 [Zone View System] 카메라 뷰포트에 보이는 구역들을 시각적으로 렌더링합니다.
     * (디버그 모드 또는 신(God) 모드의 오버레이로 사용)
     */
    render(ctx, camera) {
        const viewFlags = this.engine.viewFlags || {};
        const isZoneTileActive = viewFlags.ZONETILE || viewFlags.showZones || viewFlags.zone;
        const isVillageTileActive = viewFlags.VILLAGETILE || viewFlags.showVillageInfo || viewFlags.showVillages || viewFlags.village;

        // 💡 [핵심] 게임 엔진의 메인 루프가 VillageSystem의 렌더링을 누락하는 현상을 방지하기 위해,
        // 화면 렌더링이 확실히 보장된 ZoneManager에서 마을 영역(Territory) 타일 렌더링을 끌어와 강제로 실행합니다.
        if (isVillageTileActive) {
            const vs = this.engine.systemManager?.villageSystem;
            if (vs && typeof vs.render === 'function') {
                vs.render(ctx, camera);
            }
        }

        // 엔진의 viewFlags 객체에 ZONETILE 플래그가 켜져있을 때만 Zone 렌더링
        if (!isZoneTileActive) return;

        ctx.save();
        for (const zone of this.zones.values()) {
            const bounds = zone.bounds;
            if (!bounds) continue;

            // 🚀 [Optimization] 카메라 가시 영역(Culling) 밖의 구역은 렌더링 스킵
            if (bounds.minX > camera.x + camera.width / camera.zoom ||
                bounds.minX + bounds.width < camera.x ||
                bounds.minY > camera.y + camera.height / camera.zoom ||
                bounds.minY + bounds.height < camera.y) {
                continue;
            }

            const screenX = (bounds.minX - camera.x) * camera.zoom;
            const screenY = (bounds.minY - camera.y) * camera.zoom;
            const screenW = bounds.width * camera.zoom;
            const screenH = bounds.height * camera.zoom;

            // 🎨 구역 타입별 색상 설정 (Color Coding)
            let color;
            let icon = '';
            switch (zone.type) {
                case 'residential': color = '33, 150, 243'; icon = '🏠'; break; // 파랑 (주거)
                case 'lumber': color = '76, 175, 80'; icon = '🪵'; break;      // 초록 (벌목)
                case 'gathering': color = '76, 175, 80'; icon = '🧺'; break;   // 초록 (채집)
                case 'mining': color = '158, 158, 158'; icon = '⛏️'; break;    // 회색 (채광)
                case 'farming': color = '255, 193, 7'; icon = '🌾'; break;     // 노랑 (농사)
                case 'military': color = '244, 67, 54'; icon = '⚔️'; break;    // 빨강 (군사)
                default: color = '156, 39, 176'; icon = '📍'; break;           // 보라 (기타)
            }

            // 🚀 타일 기반 구역 렌더링
            if (zone.territory && zone.territory.size > 0) {
                const TILE_SIZE = 16;
                ctx.fillStyle = `rgba(${color}, 0.25)`;
                ctx.strokeStyle = `rgba(${color}, 0.6)`;
                ctx.lineWidth = 1 * camera.zoom;

                for (const key of zone.territory) {
                    const tx = key & 0xFFFF;
                    const ty = key >> 16;
                    const worldX = tx * TILE_SIZE;
                    const worldY = ty * TILE_SIZE;

                    // 컬링
                    if (worldX + TILE_SIZE < camera.x || worldX > camera.x + camera.width / camera.zoom ||
                        worldY + TILE_SIZE < camera.y || worldY > camera.y + camera.height / camera.zoom) {
                        continue;
                    }

                    const sX = (worldX - camera.x) * camera.zoom;
                    const sY = (worldY - camera.y) * camera.zoom;
                    const size = TILE_SIZE * camera.zoom;
                    const gap = 1 * camera.zoom;

                    ctx.fillRect(sX + gap, sY + gap, size - gap * 2, size - gap * 2);
                    ctx.strokeRect(sX + gap, sY + gap, size - gap * 2, size - gap * 2);
                }
            }
            // 🚀 [Tile Fix] 사각형 기반 렌더링을 완전히 제거하고 타일 기반만 허용하거나 라벨만 표시합니다.
            
            // 3. 구역 라벨 및 정보 텍스트 (중앙 정렬)
            ctx.fillStyle = `rgba(${color}, 1.0)`;
            ctx.font = `bold ${Math.max(12, 14 * camera.zoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const workerCount = zone.assignedWorkers ? zone.assignedWorkers.size : 0;
            ctx.fillText(`${zone.type.toUpperCase()} [${workerCount}명]`, screenX + screenW / 2, screenY + screenH / 2);
        }
        ctx.restore();
    }
}
