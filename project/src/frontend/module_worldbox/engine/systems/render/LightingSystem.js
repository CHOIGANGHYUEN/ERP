import System from '../../core/System.js';

/**
 * 💡 LightingSystem
 * 동적 광원(불, 마법, 발광체 등)을 추적하고 렌더링에 필요한 조명 데이터를 제공합니다.
 * RenderCoordinator에서 이 시스템의 데이터를 가져와 Global Illumination(GI) 맵을 그립니다.
 */
export default class LightingSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        
        // 정적 광원 및 동적 광원 목록
        this.lights = [];
        
        // [Expert Optimization] 조명 효과 캐싱
        this.lightGradientCache = new Map();
    }

    update(dt, time) {
        // 매 프레임 광원 목록 초기화
        this.lights.length = 0;

        const em = this.entityManager;
        if (!em) return;

        const camera = this.engine.camera;
        const margin = 150;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        // 1. 🏗️ 건축물 광원 (캠프파이어, 화로 등)
        const buildingItems = em.buildingIds.items;
        for (let i = 0, len = buildingItems.length; i < len; i++) {
            const id = buildingItems[i];
            const entity = em.entities.get(id);
            if (!entity) continue;
            
            const struct = entity.components.get('Structure');
            if (struct && struct.isComplete) {
                const t = entity.components.get('Transform');
                if (!t) continue;

                // 🚀 [Culling] 화면 밖 광원은 목록에서 제외
                if (t.x < viewX || t.x > viewX + viewW || t.y < viewY || t.y > viewY + viewH) continue;

                if (struct.type === 'campfire') {
                    // 불규칙하게 깜빡이는 불빛 효과 (Flicker)
                    const flicker = Math.sin(time * 0.01 + id) * 0.1 + 0.9;
                    this.lights.push({
                        x: t.x,
                        y: t.y,
                        radius: 120 * flicker,
                        intensity: 0.8 * flicker,
                        color: 'rgba(255, 150, 50, 0.5)' // 따뜻한 주황색
                    });
                } else if (struct.type === 'furnace' || struct.type === 'smithy') {
                    const flicker = Math.sin(time * 0.005 + id) * 0.05 + 0.95;
                    this.lights.push({
                        x: t.x,
                        y: t.y,
                        radius: 150 * flicker,
                        intensity: 0.7 * flicker,
                        color: 'rgba(255, 100, 30, 0.4)' // 뜨거운 붉은빛
                    });
                }
            }
        }

        // 2. 🦊 동적 발광체 (DOD RenderBuffer 기반 검색 권장하나 현재는 Visual 필터링)
        const denseIds = em.denseIds;
        for (let i = 0; i < denseIds.length; i++) {
            const id = denseIds[i];
            const entity = em.entities.get(id);
            const visual = entity?.components.get('Visual');
            if (visual && visual.subtype === 'fireball') {
                const t = entity.components.get('Transform');
                if (t) {
                    // 🚀 [Culling]
                    if (t.x < viewX || t.x > viewX + viewW || t.y < viewY || t.y > viewY + viewH) continue;

                    this.lights.push({
                        x: t.x,
                        y: t.y,
                        radius: 80,
                        intensity: 1.0,
                        color: 'rgba(255, 50, 0, 0.6)'
                    });
                }
            }
        }
    }

    /**
     * 🖌️ 오프스크린 캔버스 캐싱을 활용한 그라디언트 렌더링
     */
    getLightGradient(ctx, radius, color, intensity) {
        const key = `${radius}_${color}_${intensity.toFixed(2)}`;
        let canvas = this.lightGradientCache.get(key);
        
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = radius * 2;
            canvas.height = radius * 2;
            const lctx = canvas.getContext('2d', { alpha: true });
            
            const grad = lctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
            grad.addColorStop(0, color);
            // 정규식으로 rgba 문자열에서 alpha 값만 추출하여 투명도로 변환
            const alphaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            if (alphaMatch) {
                const [, r, g, b, a] = alphaMatch;
                grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            } else {
                grad.addColorStop(1, 'transparent');
            }
            
            lctx.fillStyle = grad;
            lctx.globalAlpha = intensity;
            lctx.beginPath();
            lctx.arc(radius, radius, radius, 0, Math.PI * 2);
            lctx.fill();
            
            this.lightGradientCache.set(key, canvas);
            
            // 캐시 크기 관리
            if (this.lightGradientCache.size > 50) {
                const firstKey = this.lightGradientCache.keys().next().value;
                this.lightGradientCache.delete(firstKey);
            }
        }
        
        return canvas;
    }
}
