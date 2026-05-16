import NatureRenderRegistry from './NatureRenderRegistry.js';

/**
 * 🌲 NatureRenders (Facade)
 * 환경 자원 및 식생 렌더링을 총괄하며, 레지스트리를 통해 OCP를 준수합니다.
 */
export const NatureRenders = {
    registry: new NatureRenderRegistry(),

    render(ctx, type, t, v, time, wind, entity) {
        const isWithered = v.isWithered || false;
        const renderer = this.registry.getRenderer(type);

        if (renderer) {
            renderer.draw(ctx, t, v, isWithered, time, wind, entity);
        } else {
            this.drawFallback(ctx, t, v);
        }
    },

    drawFallback(ctx, t, v) {
        ctx.fillStyle = v.color || '#ffffff';
        ctx.fillRect(-1, -1, 2, 2);
    }
};
