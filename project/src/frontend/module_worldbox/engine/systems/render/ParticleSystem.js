import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';

export default class ParticleSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.particles = [];

        // 🔗 명시적 바인딩 (Context Loss 방지)
        this.addParticles = this.addParticles.bind(this);
        this.addEffectParticles = this.addEffectParticles.bind(this);
        this.addDust = this.addDust.bind(this);
        this.addZzz = this.addZzz.bind(this);
        this.addBlood = this.addBlood.bind(this);

        this.eventBus.on('SPAWN_PARTICLES', this.addParticles);
        this.eventBus.on('SPAWN_EFFECT_PARTICLES', this.addEffectParticles);
        
        // 🐾 동물 상태/이벤트 관련 특수 파티클 수신
        this.eventBus.on('SPAWN_DUST', this.addDust);
        this.eventBus.on('SPAWN_ZZZ', this.addZzz);
        this.eventBus.on('SPAWN_BLOOD', this.addBlood);
    }

    destroy() {
        this.eventBus.off('SPAWN_PARTICLES', this.addParticles);
        this.eventBus.off('SPAWN_EFFECT_PARTICLES', this.addEffectParticles);
        this.eventBus.off('SPAWN_DUST', this.addDust);
        this.eventBus.off('SPAWN_ZZZ', this.addZzz);
        this.eventBus.off('SPAWN_BLOOD', this.addBlood);
        this.particles = [];
    }

    enforceCap() {
        const MAX_PARTICLES = 800;
        if (this.particles.length > MAX_PARTICLES) {
            this.particles.splice(0, this.particles.length - MAX_PARTICLES);
        }
    }

    /**
     * 기존 바이옴/식생 툴용 파티클 추가
     */
    addParticles({ x, y, actionType, biome, color, count, resourceId, treeType, brushSize = 15 }) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * brushSize * 3,
                y: y + (Math.random() - 0.5) * brushSize * 3 - 150,
                targetY: y + (Math.random() - 0.5) * brushSize * 3,
                type: 'BIOME_TOOL',
                action: actionType,
                biome,
                resourceId,
                color,
                speed: 4 + Math.random() * 3,
                treeType,
                life: 1.0,
                maxLife: 1.0
            });
        }
    }

    /**
     * 일반적인 효과 파티클 추가
     */
    addEffectParticles({ x, y, count, color, speed = 2, type = 'EFFECT' }) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 5,
                y: y + (Math.random() - 0.5) * 5,
                vx: (Math.random() - 0.5) * speed,
                vy: (Math.random() - 0.5) * speed,
                color,
                type,
                life: 1 + Math.random() * 0.5,
                maxLife: 1.5,
                alpha: 1
            });
        }
    }

    addDust({ x, y, count = 3 }) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y: y + 2,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -Math.random() * 0.5,
                color: 'rgba(200, 180, 150, 0.6)',
                type: 'DUST',
                size: 1 + Math.random() * 2,
                life: 0.8,
                maxLife: 0.8
            });
        }
    }

    addZzz({ x, y }) {
        this.particles.push({
            x: x + 5, y: y - 10,
            vx: 0.2 + Math.random() * 0.2,
            vy: -0.3,
            color: '#ffffff',
            type: 'ZZZ',
            text: Math.random() > 0.5 ? 'Z' : 'z',
            size: 6 + Math.random() * 4,
            life: 2.0,
            maxLife: 2.0
        });
    }

    addBlood({ x, y, count = 5 }) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 2,
                color: '#d32f2f',
                type: 'BLOOD',
                size: 1.5,
                life: 1.0,
                maxLife: 1.0
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
                    this.eventBus.emit('APPLY_TOOL_EFFECT', { ...p });
                    this.particles.splice(i, 1);
                }
            } else {
                // 일반 및 특수 이펙트 물리 업데이트
                p.x += p.vx || 0;
                p.y += p.vy || 0;
                
                if (p.type === 'BLOOD') p.vy += 0.1; // 중력 적용
                if (p.type === 'ZZZ') p.vx = Math.sin(time * 0.005) * 0.5; // 부유 효과

                p.life -= dt;
                p.alpha = p.life / (p.maxLife || 1);
                
                if (p.life <= 0) {
                    this.particles.splice(i, 1);
                }
            }
        }
        
        this.enforceCap();
    }

    getParticles() {
        return this.particles;
    }

}