import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🌍 VillageTerritoryManager
 * 마을의 영토 확장 트랜잭션을 전담합니다.
 * 영토 확장 시 ZoneManager와의 동기화를 보장하여 AI 데드락을 방지합니다.
 */
export default class VillageTerritoryManager {
    constructor(entityManager, engine) {
        this.em = entityManager;
        this.engine = engine;
    }

    /**
     * 🚀 [Atomic Transaction] 새로운 타일을 영토로 편입하고 구역을 동기화합니다.
     */
    claimTile(villageId, tx, ty) {
        const vs = this.engine.systemManager?.villageSystem;
        const zm = this.engine.systemManager?.zoneManager;
        const village = vs?.getVillage(villageId);

        if (!village || !zm) return false;

        const key = (ty << 16) | tx;

        // 1. 중복 및 소유권 확인
        if (village.territory.has(key)) return false;

        // 2. 타 마을 소유권 충돌 확인
        for (const other of vs.villages.values()) {
            if (other.id !== villageId && other.territory && other.territory.has(key)) {
                // [Conflict] 상대 영토에서 제거 (탈취 로직)
                other.territory.delete(key);
                zm.removeTileFromZone(other.residentialZoneId, tx, ty);
                zm.removeTileFromZone(other.lumberZoneId, tx, ty);
                break;
            }
        }

        // 3. 원자적 데이터 갱신
        village.territory.add(key);
        village.territorySize = village.territory.size;

        // 4. 지형 버퍼 동기화
        this._syncTerrainBuffer(villageId, tx, ty);

        // 5. ⚡ [Critical Sync] 구역 리밸런싱 강제 호출 (AI 데드락 방지)
        zm.rebalanceVillageZones(villageId);

        this.engine.eventBus?.emit('VILLAGE_EXPANDED', { villageId, tx, ty });
        GlobalLogger.info(`🌍 [Territory] Village ${villageId} claimed (${tx}, ${ty}). Zones rebalanced.`);

        return true;
    }

    _syncTerrainBuffer(villageId, tx, ty) {
        const territoryBuffer = this.engine.terrainGen?.territoryBuffer;
        if (!territoryBuffer) return;

        const mapWidth = this.engine.mapWidth;
        for (let dy = 0; dy < 16; dy++) {
            const start = (ty * 16 + dy) * mapWidth + (tx * 16);
            territoryBuffer.fill(villageId, start, start + 16);
        }

        // 시각적 갱신을 위해 청크 더티 표시
        this.engine.chunkManager?.markDirty(tx * 16, ty * 16);
    }

    /** 🔍 확장이 가능한 인접 타일 후보군을 반환합니다. */
    getExpansionCandidates(village) {
        if (!village.territory) return [];

        const adjacent = new Map();
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const mapW = (this.engine.mapWidth / 16);
        const mapH = (this.engine.mapHeight / 16);

        for (const key of village.territory) {
            const tx = key & 0xFFFF, ty = key >> 16;
            for (const [dx, dy] of dirs) {
                const nx = tx + dx, ny = ty + dy;
                if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) continue;

                const nKey = (ny << 16) | nx;
                if (!village.territory.has(nKey)) {
                    adjacent.set(nKey, { tx: nx, ty: ny });
                }
            }
        }
        return Array.from(adjacent.values());
    }
}
