import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import ObjectPool from '../../utils/ObjectPool.js';

export default class ParticleSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.particles = [];

        // 🚀 [Expert Optimization] Object Pooling for Particles
        this.pool = new ObjectPool(
            () => ({}), // Factory: Simple object
            (p) => {    // Reset: Clear all properties for safety
                for (const key in p) delete p[key];
            },
            500 // Initial size
        );

        // 🔗 명시적 바인딩 (Context Loss 방지)
        this.addParticles = this.addParticles.bind(this);
        this.addEffectParticles = this.addEffectParticles.bind(this);
        this.addDust = this.addDust.bind(this);
        this.addZzz = this.addZzz.bind(this);
        this.addBlood = this.addBlood.bind(this);
        this.spawn = this.spawn.bind(this);

        this.eventBus.on('SPAWN_PARTICLES', this.addParticles);
        this.eventBus.on('SPAWN_EFFECT_PARTICLES', this.addEffectParticles);
        
        // 🐾 동물 상태/이벤트 관련 특수 파티클 수신
        this.eventBus.on('SPAWN_DUST', this.addDust);
        this.eventBus.on('SPAWN_ZZZ', this.addZzz);
        this.eventBus.on('SPAWN_BLOOD', this.addBlood);
    }

    /**
     * 🚀 [Universal Spawner] 다양한 타입의 파티클을 범용적으로 생성
     */
    spawn(type, options = {}) {
        const { x = 0, y = 0, color = '#ffffff', size = 2, velocity = { x: 0, y: 0 }, life = 1.0 } = options;
        
        const p = this.pool.get();
        p.x = x; p.y = y;
        p.vx = velocity.x; p.vy = velocity.y;
        p.color = color;
        p.size = size;
        p.type = type.toUpperCase();
        p.life = life;
        p.maxLife = life;
        p.alpha = 1.0;
        
        this.particles.push(p);
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
            const removed = this.particles.splice(0, this.particles.length - MAX_PARTICLES);
            removed.forEach(p => this.pool.release(p));
        }
    }

    /**
     * 기존 바이옴/식생 툴용 파티클 추가
     */
    addParticles({ x, y, actionType, biome, color, count, resourceId, treeType, brushSize = 15 }) {
        for (let i = 0; i < count; i++) {
            const p = this.pool.get();
            p.x = x + (Math.random() - 0.5) * brushSize * 3;
            p.y = y + (Math.random() - 0.5) * brushSize * 3 - 150;
            p.targetY = y + (Math.random() - 0.5) * brushSize * 3;
            p.type = 'BIOME_TOOL';
            p.action = actionType;
            p.biome = biome;
            p.resourceId = resourceId;
            p.color = color;
            p.speed = 4 + Math.random() * 3;
            p.treeType = treeType;
            p.life = 1.0;
            p.maxLife = 1.0;
            
            this.particles.push(p);
        }
    }

    /**
     * 일반적인 효과 파티클 추가
     */
    addEffectParticles({ x, y, count, color, speed = 2, type = 'EFFECT' }) {
        for (let i = 0; i < count; i++) {
            const p = this.pool.get();
            p.x = x + (Math.random() - 0.5) * 5;
            p.y = y + (Math.random() - 0.5) * 5;
            p.vx = (Math.random() - 0.5) * speed;
            p.vy = (Math.random() - 0.5) * speed;
            p.color = color;
            p.type = type;
            p.life = 1 + Math.random() * 0.5;
            p.maxLife = 1.5;
            p.alpha = 1;
            
            this.particles.push(p);
        }
    }

    addDust({ x, y, count = 3 }) {
        for (let i = 0; i < count; i++) {
            const p = this.pool.get();
            p.x = x; p.y = y + 2;
            p.vx = (Math.random() - 0.5) * 0.5;
            p.vy = -Math.random() * 0.5;
            p.color = 'rgba(200, 180, 150, 0.6)';
            p.type = 'DUST';
            p.size = 1 + Math.random() * 2;
            p.life = 0.8;
            p.maxLife = 0.8;
            
            this.particles.push(p);
        }
    }

    addZzz({ x, y }) {
        const p = this.pool.get();
        p.x = x + 5; p.y = y - 10;
        p.vx = 0.2 + Math.random() * 0.2;
        p.vy = -0.3;
        p.color = '#ffffff';
        p.type = 'ZZZ';
        p.text = Math.random() > 0.5 ? 'Z' : 'z';
        p.size = 6 + Math.random() * 4;
        p.life = 2.0;
        p.maxLife = 2.0;
        
        this.particles.push(p);
    }

    addBlood({ x, y, count = 5 }) {
        for (let i = 0; i < count; i++) {
            const p = this.pool.get();
            p.x = x; p.y = y;
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = -Math.random() * 2;
            p.color = '#d32f2f';
            p.type = 'BLOOD';
            p.size = 1.5;
            p.life = 1.0;
            p.maxLife = 1.0;
            
            this.particles.push(p);
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
                    this.pool.release(p);
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
                    this.pool.release(p);
                }
            }
        }
        
        this.enforceCap();
    }

    getParticles() {
        return this.particles;
    }

}