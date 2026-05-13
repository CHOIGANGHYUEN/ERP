/**
 * 🧱 FenceRenderer
 * 울타리의 오토 타일링 및 고품질 절차적 렌더링을 담당합니다.
 */
export default class FenceRenderer {
    static draw(ctx, entity, time) {
        const transform = entity.components.get('Transform');
        const fence = entity.components.get('Fence');
        const visual = entity.components.get('Visual');
        if (!transform || !fence) return;

        const x = transform.x;
        const y = transform.y;
        const connections = fence.connections || 0;
        const material = fence.material || 'wood';
        const isBlueprint = fence.isBlueprint || false;

        ctx.save();
        ctx.translate(x, y);

        // 🎨 재질별 색상 정의
        const colors = this.getColors(material, isBlueprint);

        // 🏗️ 1. 기둥(Post) 렌더링
        this.drawPost(ctx, colors, isBlueprint);

        // 🔗 2. 연결 레일(Rails) 렌더링 (North, East, South, West)
        const spacing = 16; // 타일 크기의 절반 (32px 타일 기준)
        
        if (connections & 1) this.drawRail(ctx, 0, -spacing, colors, 'V', isBlueprint); // North
        if (connections & 2) this.drawRail(ctx, spacing, 0, colors, 'H', isBlueprint);  // East
        if (connections & 4) this.drawRail(ctx, 0, spacing, colors, 'V', isBlueprint);  // South
        if (connections & 8) this.drawRail(ctx, -spacing, 0, colors, 'H', isBlueprint); // West

        ctx.restore();
    }

    static getColors(material, isBlueprint) {
        if (isBlueprint) return { main: 'rgba(255, 255, 255, 0.4)', shadow: 'rgba(0, 0, 0, 0.2)' };

        switch (material) {
            case 'stone':
                return { main: '#9e9e9e', shadow: '#616161', accent: '#bdbdbd' };
            case 'iron':
                return { main: '#455a64', shadow: '#263238', accent: '#78909c' };
            case 'wood':
            default:
                return { main: '#795548', shadow: '#3e2723', accent: '#a1887f' };
        }
    }

    static drawPost(ctx, colors, isBlueprint) {
        ctx.fillStyle = colors.shadow;
        ctx.fillRect(-3, -8, 6, 12); // 그림자/뒷면
        ctx.fillStyle = colors.main;
        ctx.fillRect(-3, -10, 6, 10); // 정면
        
        if (!isBlueprint) {
            ctx.fillStyle = colors.accent;
            ctx.fillRect(-3, -10, 6, 2); // 윗면 하이라이트
        }
    }

    static drawRail(ctx, dx, dy, colors, direction, isBlueprint) {
        ctx.save();
        if (isBlueprint) ctx.setLineDash([2, 2]);

        ctx.strokeStyle = colors.shadow;
        ctx.lineWidth = direction === 'H' ? 4 : 2;
        
        ctx.beginPath();
        if (direction === 'H') {
            // 가로 레일 (두 줄)
            ctx.moveTo(0, -6); ctx.lineTo(dx, -6);
            ctx.moveTo(0, -2); ctx.lineTo(dx, -2);
        } else {
            // 세로 레일
            ctx.moveTo(0, 0); ctx.lineTo(dx, dy);
        }
        ctx.stroke();

        if (!isBlueprint) {
            ctx.strokeStyle = colors.main;
            ctx.lineWidth = direction === 'H' ? 2 : 1;
            ctx.beginPath();
            if (direction === 'H') {
                ctx.moveTo(0, -6); ctx.lineTo(dx, -6);
                ctx.moveTo(0, -2); ctx.lineTo(dx, -2);
            } else {
                ctx.moveTo(0, 0); ctx.lineTo(dx, dy);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    /** 🔄 [Optimization] 주변 울타리를 탐색하여 연결 비트마스크를 계산합니다. */
    static calculateConnections(id, x, y, spatialHash, em) {
        let mask = 0;
        const spacing = 32; // 그리드 크기

        const directions = [
            { bit: 1, dx: 0, dy: -spacing }, // N
            { bit: 2, dx: spacing, dy: 0 },  // E
            { bit: 4, dx: 0, dy: spacing },  // S
            { bit: 8, dx: -spacing, dy: 0 }  // W
        ];

        for (const dir of directions) {
            const nearby = spatialHash.query(x + dir.dx, y + dir.dy, 5);
            for (const nid of nearby) {
                if (nid === id) continue;
                const ent = em.entities.get(nid);
                if (ent) {
                    if (ent.components.has('Fence')) {
                        mask |= dir.bit;
                        break;
                    }
                    // 울타리 문(fence_gate)도 연결 대상으로 포함
                    const building = ent.components.get('Building');
                    if (building && building.type === 'fence_gate') {
                        mask |= dir.bit;
                        break;
                    }
                }
            }
        }
        return mask;
    }
}
