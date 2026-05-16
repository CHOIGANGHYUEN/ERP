/**
 * 🏘️ VillageOverlayRenderer
 * 마을의 영토, 울타리, 이름표 등 시각적 정보를 렌더링하는 전용 클래스입니다.
 * VillageSystem에서 분리되어 SRP(단일 책임 원칙)를 준수합니다.
 */
export default class VillageOverlayRenderer {
    static render(ctx, camera, villageSystem, engine) {
        const viewFlags = engine.viewFlags || {};
        const isActive = viewFlags.VILLAGETILE || viewFlags.showVillageInfo || viewFlags.showVillages || viewFlags.NATIONTILE || viewFlags.nation;
        if (!isActive) return;

        ctx.save();
        const TILE_SIZE = 16;

        for (const village of villageSystem.villages.values()) {
            if (!village.territory || village.territory.size === 0) continue;

            // 1. 마을 색상 결정 (국가 색상 우선)
            let colorHex = '#4fc3f7';
            if (village.nationId !== -1) {
                const ns = engine.systemManager?.nationSystem;
                const nation = ns?.nations.get(village.nationId);
                if (nation && nation.color) colorHex = nation.color;
            }

            const hex = colorHex.replace('#', '');
            const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16) || 79;
            const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16) || 195;
            const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16) || 247;

            // 🎨 영토 타일 렌더링
            this._renderTerritoryTiles(ctx, camera, village, r, g, b, TILE_SIZE);

            // 🛡️ 외곽선 울타리(Fence) 렌더링
            this._renderFences(ctx, camera, village, TILE_SIZE);

            // 🏷️ 마을 라벨 렌더링
            this._renderLabels(ctx, camera, village, r, g, b);
        }
        ctx.restore();
    }

    /** 🎨 마을 영역 타일 그리기 */
    static _renderTerritoryTiles(ctx, camera, village, r, g, b, TILE_SIZE) {
        const gap = 1.0 * camera.zoom;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.lineWidth = 1 * camera.zoom;

        for (const key of village.territory) {
            const tx = key & 0xFFFF;
            const ty = key >> 16;
            const worldX = tx * TILE_SIZE;
            const worldY = ty * TILE_SIZE;

            // 컬링 (화면 밖 무시)
            if (worldX + TILE_SIZE > camera.x && worldX < camera.x + camera.width / camera.zoom &&
                worldY + TILE_SIZE > camera.y && worldY < camera.y + camera.height / camera.zoom) {

                const screenX = (worldX - camera.x) * camera.zoom;
                const screenY = (worldY - camera.y) * camera.zoom;
                const size = TILE_SIZE * camera.zoom;

                ctx.fillRect(screenX + gap, screenY + gap, size - gap * 2, size - gap * 2);
                ctx.strokeRect(screenX + gap, screenY + gap, size - gap * 2, size - gap * 2);
            }
        }
    }

    /** 🛡️ 외곽선 울타리(Fence) 모양 프로시저럴 렌더링 */
    static _renderFences(ctx, camera, village, TILE_SIZE) {
        ctx.strokeStyle = '#5D4037'; // 나무 기둥 색상
        ctx.lineWidth = 4 * camera.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const key of village.territory) {
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

            const drawLine = (x1, y1, x2, y2) => {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                ctx.fillStyle = '#3E2723';
                ctx.beginPath();
                ctx.arc(x1, y1, 2.5 * camera.zoom, 0, Math.PI * 2);
                ctx.arc(x2, y2, 2.5 * camera.zoom, 0, Math.PI * 2);
                ctx.fill();
            };

            if (!village.territory.has(((ty - 1) << 16) | tx)) drawLine(sX, sY, sX + size, sY); // 상
            if (!village.territory.has(((ty + 1) << 16) | tx)) drawLine(sX, sY + size, sX + size, sY + size); // 하
            if (!village.territory.has((ty << 16) | (tx - 1))) drawLine(sX, sY, sX, sY + size); // 좌
            if (!village.territory.has((ty << 16) | (tx + 1))) drawLine(sX + size, sY, sX + size, sY + size); // 우
        }
    }

    /** 🏷️ 마을 라벨 렌더링 */
    static _renderLabels(ctx, camera, village, r, g, b) {
        const screenCx = (village.centerX - camera.x) * camera.zoom;
        const screenCy = (village.centerY - camera.y) * camera.zoom;

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.max(12, 14 * camera.zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(`🏘️ ${village.name}`, screenCx, screenCy - 20 * camera.zoom);

        ctx.font = `bold ${Math.max(10, 11 * camera.zoom)}px sans-serif`;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillText(`(${village.territory.size} Tiles)`, screenCx, screenCy - 5 * camera.zoom);

        ctx.shadowBlur = 0;
    }
}
