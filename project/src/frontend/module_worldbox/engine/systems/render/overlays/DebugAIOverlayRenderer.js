/**
 * 🧠 DebugAIOverlayRenderer
 * AI 타겟 라인, 탐색 반경(Radar), 경로 시각화 등 디버그 오버레이를 담당합니다.
 * RenderCoordinator.js에서 SRP에 따라 분리되었습니다.
 */
export default class DebugAIOverlayRenderer {
    constructor(coordinator) {
        this.rc = coordinator;
        this.engine = coordinator.engine;
    }

    render(ctx) {
        const engine = this.engine;
        const flags = engine.viewFlags;
        const time = performance.now();
        const em = engine.entityManager;

        if (flags.debugSelectedAI && engine.selectedId !== null) {
            const entity = em.entities.get(engine.selectedId);
            if (entity) this._drawEntityAIInfo(ctx, entity, time);
            return;
        }

        if (flags.debugAI) {
            const camera = engine.camera;
            const margin = 100;
            const viewX = camera.x - margin, viewY = camera.y - margin;
            const viewW = (camera.width / camera.zoom) + margin * 2, viewH = (camera.height / camera.zoom) + margin * 2;
            const visibleIds = engine.spatialHash?.queryRect(viewX, viewY, viewW, viewH) || [];
            for (const id of visibleIds) {
                const entity = em.entities.get(id);
                if (entity?.components.has('AIState')) this._drawEntityAIInfo(ctx, entity, time);
            }
        }
    }

    _drawEntityAIInfo(ctx, entity, time) {
        const em = this.engine.entityManager;
        const state = entity.components.get('AIState'), transform = entity.components.get('Transform');
        if (!state || !transform) return;

        ctx.save();
        const { x, y } = transform;
        const isHuman = entity.components.get('Animal')?.type === 'human';
        const themeColor = isHuman ? '#00f2ff' : '#ffffff', themeRgb = isHuman ? '0, 242, 255' : '255, 255, 255';

        ctx.fillStyle = themeColor; ctx.font = 'bold 9px Inter, Arial'; ctx.textAlign = 'center';
        ctx.fillText((state.mode || 'Normal').toUpperCase(), x, y - 15);

        let range = state.searchRange || 50;
        if (range > 300) range = 300;

        if (range > 0) {
            const isSearching = !state.targetId;
            ctx.beginPath(); ctx.arc(x, y, range, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${themeRgb}, ${isSearching ? 0.12 : 0.04})`; ctx.fill();
            ctx.beginPath(); ctx.setLineDash([8, 4]); ctx.lineDashOffset = -time * 0.05;
            ctx.arc(x, y, range, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${themeRgb}, ${isSearching ? 0.4 : 0.15})`;
            ctx.lineWidth = 1.5; ctx.stroke();
            if (isSearching) {
                const pulse = (time * 0.001) % 1.0;
                ctx.beginPath(); ctx.setLineDash([]); ctx.arc(x, y, range * pulse, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${themeRgb}, ${0.5 * (1 - pulse)})`; ctx.lineWidth = 2; ctx.stroke();
            }
        }

        const target = state.targetId ? em.entities.get(state.targetId) : null;
        let targetPos = target ? target.components.get('Transform') : (state.path?.length ? state.path[state.path.length - 1] : null);

        if (targetPos) {
            ctx.beginPath(); ctx.lineWidth = 1.5; ctx.strokeStyle = isHuman ? 'rgba(0, 242, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)';
            ctx.setLineDash([5, 5]); ctx.lineDashOffset = -time * 0.01; ctx.moveTo(x, y);
            if (state.path?.length) for (let i = (state.pathIndex || 0); i < state.path.length; i++) ctx.lineTo(state.path[i].x, state.path[i].y);
            else ctx.lineTo(targetPos.x, targetPos.y);
            ctx.stroke();

            if (state.path?.length) {
                ctx.setLineDash([]); ctx.fillStyle = themeColor;
                for (let i = (state.pathIndex || 0); i < state.path.length; i++) {
                    ctx.beginPath(); ctx.arc(state.path[i].x, state.path[i].y, 1.5, 0, Math.PI * 2); ctx.fill();
                }
            }

            const rawName = state.targetName || target?.components.get('Visual')?.type;
            if (rawName) {
                ctx.fillStyle = themeColor; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center';
                ctx.fillText(String(rawName).toUpperCase(), targetPos.x, targetPos.y - 12);
                const cross = 5 + Math.sin(time * 0.01) * 2;
                ctx.beginPath(); ctx.setLineDash([]); ctx.moveTo(targetPos.x - cross, targetPos.y); ctx.lineTo(targetPos.x + cross, targetPos.y);
                ctx.moveTo(targetPos.x, targetPos.y - cross); ctx.lineTo(targetPos.x, targetPos.y + cross);
                ctx.strokeStyle = themeColor; ctx.stroke();
            }
        }
        ctx.restore();
    }
}
