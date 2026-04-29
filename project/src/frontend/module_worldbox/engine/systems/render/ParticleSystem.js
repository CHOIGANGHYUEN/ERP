import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';

export default class ParticleSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.particles = [];

        // EventBus를 통해 파티클 생성 이벤트를 수신합니다.
        this.eventBus.on('SPAWN_PARTICLES', (payload) => this.addParticles(payload));
        this.eventBus.on('SPAWN_EFFECT_PARTICLES', (payload) => this.addEffectParticles(payload));
    }

    addParticles({ x, y, actionType, biome, color, count, resourceId, treeType, brushSize = 15 }) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * brushSize * 3,
                y: y + (Math.random() - 0.5) * brushSize * 3 - 150,
                targetY: y + (Math.random() - 0.5) * brushSize * 3,
                type: 'BIOME_TOOL', // 도구로 인한 바이옴/식생 파티클
                action: actionType,
                biome: biome, // biomeId
                resourceId: resourceId,
                color: color,
                speed: 4 + Math.random() * 3,
                treeType: treeType,
                life: 1 // 파티클 수명 (1초)
            });
        }
    }

    addEffectParticles({ x, y, count, color, speed = 2, type = 'EFFECT' }) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 5,
                y: y + (Math.random() - 0.5) * 5,
                vx: (Math.random() - 0.5) * speed,
                vy: (Math.random() - 0.5) * speed,
                color: color,
                type: type,
                life: 1 + Math.random() * 0.5, // 1초 ~ 1.5초 수명
                alpha: 1
            });
        }
    }

    update(dt, time) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.type === 'BIOME_TOOL') {
                if (p.y < p.targetY) {
                    p.y += p.speed;
                } else {
                    // 파티클이 지면에 닿으면 이벤트 버스를 통해 적용 명령만 내립니다. (디커플링)
                    this.eventBus.emit('APPLY_TOOL_EFFECT', {
                        action: p.action, 
                        x: p.x, 
                        y: p.y, 
                        biome: p.biome, 
                        resourceId: p.resourceId,
                        color: p.color,
                        treeType: p.treeType
                    });
                    this.particles.splice(i, 1); // 파티클 제거
                }
            } else if (p.type === 'EFFECT') {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= dt;
                p.alpha = p.life;
                if (p.life <= 0) {
                    this.particles.splice(i, 1);
                }
            }
        }
    }

    getParticles() {
        return this.particles;
    }
}