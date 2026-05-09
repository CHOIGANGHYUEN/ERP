import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import ObjectPool from '../../utils/ObjectPool.js';

export default class ParticleSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.particles = [];

        // 🚀 [Expert Optimization] Object Pooling for Particles
        // Hidden Class 유지를 위해 모든 프로퍼티를 미리 정의하고 초기화합니다.
        this.pool = new ObjectPool(
            () => ({
                x: 0, y: 0, vx: 0, vy: 0, vz: 0, z: 0,
                color: '', size: 0, type: '', life: 0, maxLife: 0,
                alpha: 1, rotation: 0, targetY: 0, action: '',
                biome: 0, resourceId: -1, treeType: '', text: ''
            }),
            (p) => {
                p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.vz = 0; p.z = 0;
                p.color = ''; p.size = 0; p.type = ''; p.life = 0; p.maxLife = 0;
                p.alpha = 1; p.rotation = 0; p.targetY = 0; p.action = '';
                p.biome = 0; p.resourceId = -1; p.treeType = ''; p.text = '';
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
        this.eventBus.on('SPAWN_DEBRIS', (data) => this.addDebris(data));
    }

    addDebris({ x, y, count = 8, color = '#5d4037', speed = 3 }) {
        for (let i = 0; i < count; i++) {
            const p = this.pool.get();
            p.x = x; p.y = y;
            p.vx = (Math.random() - 0.5) * speed;
            p.vy = (Math.random() - 0.5) * speed;
            p.vz = -2 - Math.random() * 4; // 위로 튀어오름
            p.z = -5;
            p.color = color;
            p.type = 'DEBRIS';
            p.size = 2 + Math.random() * 3;
            p.life = 2.0;
            p.maxLife = 2.0;
            p.rotation = Math.random() * Math.PI * 2;
            
            this.particles.push(p);
        }
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
                if (p.type === 'RAINDROP') p.x += (Math.random() - 0.5) * 0.5; // 빗방울 약간 흔들림
                if (p.type === 'SNOWFLAKE') p.x += Math.sin(time * 0.002 + p.y) * 0.8; // 눈송이 팔랑거림

                // 🏗️ [Task 84] Debris Physics (포물선 및 바운스)
                if (p.type === 'DEBRIS') {
                    p.vz = (p.vz || 0) + 0.25; // 중력 (Z축 시뮬레이션)
                    p.z = (p.z || 0) + p.vz;
                    
                    if (p.z > 0) { // 지면에 닿음
                        p.z = 0;
                        p.vz *= -0.5; // 바운스 (에너지 감쇄)
                        p.vx *= 0.7; // 마찰력
                        p.vy *= 0.7;
                    }
                    
                    p.rotation = (p.rotation || 0) + (p.vx * 0.1);
                }

                p.life -= dt;
                p.alpha = Math.min(1.0, p.life / (p.maxLife || 1));
                
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