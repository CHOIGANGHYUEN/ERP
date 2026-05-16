/**
 * 🌬️ EnvironmentOverlayRenderer
 * 바람 흐름, 시간대별 광원(Ambient/Light) 등 환경 효과 렌더링을 담당합니다.
 * RenderCoordinator.js에서 SRP에 따라 분리되었습니다.
 */
export default class EnvironmentOverlayRenderer {
    constructor(coordinator) {
        this.rc = coordinator;
        this.engine = coordinator.engine;
    }

    renderWind(ctx) {
        const wind = this.engine.wind, spacing = 40, camera = this.engine.camera;
        const startX = Math.floor(camera.x / spacing) * spacing, startY = Math.floor(camera.y / spacing) * spacing;
        const endX = startX + this.engine.width / camera.zoom + spacing, endY = startY + this.engine.height / camera.zoom + spacing;

        ctx.save();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)'; ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
        for (let y = startY; y < endY; y += spacing) {
            for (let x = startX; x < endX; x += spacing) {
                const sway = wind.getSway(x, y);
                ctx.save(); ctx.translate(x, y);
                const angle = Math.atan2(sway.y, sway.x), length = Math.sqrt(sway.x * sway.x + sway.y * sway.y) * 10;
                ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();
                if (length > 2) {
                    ctx.beginPath(); ctx.moveTo(length, 0); ctx.lineTo(length - 4, -3); ctx.lineTo(length - 4, 3); ctx.fill();
                }
                ctx.restore();
            }
        }
        ctx.restore();
    }

    renderGlobalIllumination(ctx, camera) {
        const time = this.engine.timeSystem, lighting = this.engine.systemManager?.lightingSystem;
        if (!time || !lighting) return;

        let darkness = 0, ambientColor = 'rgba(0, 0, 20, 0)';
        if (time.hours >= 18) {
            darkness = 0.6 * Math.min(1.0, (time.hours - 18 + time.minutes / 60) / 3.0);
            ambientColor = `rgba(10, 10, 35, ${darkness})`;
        } else if (time.hours < 6) {
            darkness = 0.6 * Math.max(0.0, 1.0 - (time.hours + time.minutes / 60) / 6.0);
            ambientColor = `rgba(10, 10, 35, ${darkness})`;
        }

        if (darkness <= 0.05) return;

        ctx.save();
        const vw = this.rc.offscreenCanvas.width / camera.zoom, vh = this.rc.offscreenCanvas.height / camera.zoom;
        ctx.fillStyle = ambientColor; ctx.fillRect(camera.x, camera.y, vw, vh);

        if (lighting.lights.length > 0) {
            ctx.globalCompositeOperation = 'destination-out';
            for (const light of lighting.lights) {
                if (light.x + light.radius < camera.x || light.x - light.radius > camera.x + vw ||
                    light.y + light.radius < camera.y || light.y - light.radius > camera.y + vh) continue;
                ctx.drawImage(lighting.getLightGradient(ctx, light.radius, light.color, light.intensity), light.x - light.radius, light.y - light.radius);
            }
            ctx.globalCompositeOperation = 'lighter';
            for (const light of lighting.lights) {
                if (light.x + light.radius < camera.x || light.x - light.radius > camera.x + vw ||
                    light.y + light.radius < camera.y || light.y - light.radius > camera.y + vh) continue;
                ctx.drawImage(lighting.getLightGradient(ctx, light.radius, light.color, light.intensity * 0.5), light.x - light.radius, light.y - light.radius);
            }
        }
        ctx.restore();
    }
}
