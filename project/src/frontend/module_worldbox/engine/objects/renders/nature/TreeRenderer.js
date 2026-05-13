/**
 * 🌳 TreeRenderer — 절차적 나무 및 식생 렌더링 엔진 (최적화 버전)
 * [Expert Design] 뾰족뾰족한 도트 그래픽 스타일 + 오프스크린 캔버스 캐싱
 */
import { textureManager } from "../../../systems/render/TextureManager.js";
export const TreeRenderer = {
    draw(ctx, t, v, size, isWithered, time, wind, isXRay = false, entity = null) {
        // 🌲 [FALLING] 쓰러지는 나무 애니메이션
        const res = entity?.components.get('Resource');
        const isFalling = res && res.isFalling;

        if (isFalling) {
            const fallAngle = (res.fallProgress || 0) * (Math.PI / 2) * (res.fallDirection || 1);
            ctx.rotate(fallAngle);
            if (res.fallProgress >= 1.0) return;
        }

        let texKey = 'tree_pine';
        if (isWithered) texKey = 'tree_dead';
        else if (v.subtype === 'oak') texKey = 'tree_oak';

        const img = textureManager.getTexture(texKey);
        if (!img) return; // 🛡️ Safety check

        // 🌬️ 바람 흔들림 및 피격 흔들림
        const wv = wind ? wind.getSway(t.x, t.y, time) : { x: 0, y: 0 };
        const sway = isWithered ? 0 : wv.x * (size / 15);

        const health = entity?.components?.get('Health');
        const hitShake = (health && health.hitTimer > 0) ? Math.sin(time * 0.08) * 1.5 : 0;

        const scale = size / 30; // 20 -> 30으로 조정하여 크기 축소
        const drawW = 64 * scale;
        const drawH = 64 * scale;

        // 🌑 [Shadow] 나무 밑동 그림자 (타원형)
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 0, drawW * 0.4, drawW * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.drawImage(
            img,
            -drawW / 2 + sway + hitShake,
            -drawH + 2 * scale, // 🌳 [Fix] 기둥이 땅에 묻히지 않도록 오프셋 상향 조정
            drawW,
            drawH
        );

        // 🐝 벌집 오버레이
        if (v.subtype === 'beehive' && !isWithered) {
            this.drawBeehive(ctx, size / 4, size, isXRay, entity);
        }
    },

    drawBeehive(ctx, trunkW, size, isXRay, entity) {
        const bx = trunkW / 2 + 2;
        const by = -size * 0.4;
        ctx.fillStyle = '#fbc02d';
        ctx.beginPath();
        ctx.ellipse(bx, by, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a0f0d';
        ctx.beginPath();
        ctx.arc(bx, by + 1, 1, 0, Math.PI * 2);
        ctx.fill();
    }
};
