/**
 * 📍 ZoneOverlayRenderer
 * 구역(Zone)의 영역 타일, 아이콘, 작업자 수 등 시각적 정보를 렌더링하는 전용 클래스입니다.
 * ZoneManager에서 분리되어 SRP(단일 책임 원칙)를 준수합니다.
 */
export default class ZoneOverlayRenderer {
    static render(ctx, camera, zoneManager, engine) {
        const viewFlags = engine.viewFlags || {};
        const isZoneTileActive = viewFlags.ZONETILE || viewFlags.showZones || viewFlags.zone;
        const isVillageTileActive = viewFlags.VILLAGETILE || viewFlags.showVillageInfo || viewFlags.showVillages || viewFlags.village;

        // 💡 [Expert Logic] 마을 타일 활성화 시 마을 렌더러 호출 권한을 RenderCoordinator가 가지도록 하되,
        // 이곳에서는 구역 전용 렌더링만 수행합니다.

        if (!isZoneTileActive) return;

        ctx.save();
        for (const zone of zoneManager.zones.values()) {
            const bounds = zone.bounds;
            if (!bounds) continue;

            // 🚀 카메라 뷰포트 컬링
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

            // 🎨 구역 타입별 색상 및 아이콘 설정
            const config = this._getZoneConfig(zone.type);
            
            // 🚀 타일 기반 구역 영역 렌더링
            if (zone.territory && zone.territory.size > 0) {
                this._renderZoneTiles(ctx, camera, zone, config.color);
            }

            // 3. 구역 라벨 및 정보 텍스트 (중앙 정렬)
            this._renderZoneLabel(ctx, screenX, screenY, screenW, screenH, zone, config.color, camera.zoom);
        }
        ctx.restore();
    }

    static _getZoneConfig(type) {
        switch (type) {
            case 'residential': return { color: '33, 150, 243', icon: '🏠' }; // 파랑
            case 'lumber': return { color: '76, 175, 80', icon: '🪵' };      // 초록
            case 'gathering': return { color: '76, 175, 80', icon: '🧺' };   // 초록
            case 'mining': return { color: '158, 158, 158', icon: '⛏️' };    // 회색
            case 'farming': return { color: '255, 193, 7', icon: '🌾' };     // 노랑
            case 'military': return { color: '244, 67, 54', icon: '⚔️' };    // 빨강
            default: return { color: '156, 39, 176', icon: '📍' };           // 보라
        }
    }

    static _renderZoneTiles(ctx, camera, zone, color) {
        const TILE_SIZE = 16;
        ctx.fillStyle = `rgba(${color}, 0.25)`;
        ctx.strokeStyle = `rgba(${color}, 0.6)`;
        ctx.lineWidth = 1 * camera.zoom;

        const gap = 1 * camera.zoom;

        for (const key of zone.territory) {
            const tx = key & 0xFFFF;
            const ty = key >> 16;
            const worldX = tx * TILE_SIZE;
            const worldY = ty * TILE_SIZE;

            if (worldX + TILE_SIZE < camera.x || worldX > camera.x + camera.width / camera.zoom ||
                worldY + TILE_SIZE < camera.y || worldY > camera.y + camera.height / camera.zoom) {
                continue;
            }

            const sX = (worldX - camera.x) * camera.zoom;
            const sY = (worldY - camera.y) * camera.zoom;
            const size = TILE_SIZE * camera.zoom;

            ctx.fillRect(sX + gap, sY + gap, size - gap * 2, size - gap * 2);
            ctx.strokeRect(sX + gap, sY + gap, size - gap * 2, size - gap * 2);
        }
    }

    static _renderZoneLabel(ctx, x, y, w, h, zone, color, zoom) {
        ctx.fillStyle = `rgba(${color}, 1.0)`;
        ctx.font = `bold ${Math.max(12, 14 * zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const workerCount = zone.assignedWorkers ? zone.assignedWorkers.size : 0;
        ctx.fillText(`${zone.type.toUpperCase()} [${workerCount}명]`, x + w / 2, y + h / 2);
    }
}
