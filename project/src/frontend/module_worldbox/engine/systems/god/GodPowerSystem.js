import { GlobalLogger } from '../../utils/Logger.js';

/**
 * ⚡ GodPowerSystem
 * 신적인 권능(Meteor, Lightning 등)의 시뮬레이션 로직을 담당합니다.
 */
export default class GodPowerSystem {
    constructor(engine) {
        this.engine = engine;
        this.entityManager = engine.entityManager;
        this.terrainGen = engine.terrainGen;
        this.spatialHash = engine.spatialHash;
        this.eventBus = engine.eventBus;
        this.cooldowns = new Map();
        this.lastDt = 0.016; // 기본값
    }

    update(dt) {
        this.lastDt = dt;
        // 쿨다운 타이머 업데이트
        for (const [key, time] of this.cooldowns.entries()) {
            if (time > 0) {
                this.cooldowns.set(key, time - dt);
            }
        }
    }

    applyPower(type, x, y, radius = 30) {
        const cooldown = this.cooldowns.get(type) || 0;
        if (cooldown > 0) return;

        switch (type) {
            case 'meteor':
                this._applyMeteor(x, y, radius);
                this.cooldowns.set(type, 1.0); // 1초 쿨다운
                break;
            case 'lightning':
                this._applyLightning(x, y, radius);
                this.cooldowns.set(type, 0.3); // 0.3초 쿨다운
                break;
            case 'magnet':
                this._applyMagnet(x, y, radius * 2);
                break;
            case 'bless':
                this._applyBless(x, y, radius);
                this.cooldowns.set(type, 0.1);
                break;
            case 'disaster':
                this._applyDisaster(x, y, radius);
                this.cooldowns.set(type, 0.5);
                break;
        }
    }

    /** ☄️ 메테오: 지형 파괴 및 엔티티 큰 피해 */
    _applyMeteor(x, y, radius) {
        GlobalLogger.warn(`☄️ METEOR STRIKE at (${Math.floor(x)}, ${Math.floor(y)})`);
        
        // 1. 지형 파괴 (충돌구 형성)
        if (this.terrainGen) {
            this.engine.dispatchCommand({
                type: 'APPLY_FILL_TOOL',
                payload: { x, y, radius: radius * 0.8, biome: 'DIRT' }
            });
        }

        // 2. 엔티티 피해
        const nearbyIds = this.spatialHash.query(x, y, radius);
        for (const id of nearbyIds) {
            const entity = this.entityManager.entities.get(id);
            if (!entity) continue;
            
            const health = entity.components.get('Health');
            const stats = entity.components.get('BaseStats');
            const damage = 1000;

            if (health) health.takeDamage(damage);
            if (stats) stats.takeDamage(damage);

            const t = entity.components.get('Transform');
            if (t) {
                this.eventBus.emitDeferred('SPAWN_FLOATING_TEXT', {
                    x: t.x, y: t.y,
                    text: 'DEADLY!',
                    color: '#ff0000',
                    options: { size: 20, vy: -3 }
                });
            }
        }

        // 3. 시각 효과
        this.eventBus.emitDeferred('SPAWN_PARTICLES', { 
            type: 'explosion', 
            x, y, 
            count: 30, 
            color: '#ff4500' 
        });
    }

    /** ⚡ 번개: 엔티티 즉사/마비 및 불꽃 생성 */
    _applyLightning(x, y, radius) {
        GlobalLogger.info(`⚡ LIGHTNING BOLT at (${Math.floor(x)}, ${Math.floor(y)})`);

        const nearbyIds = this.spatialHash.query(x, y, radius / 2);
        for (const id of nearbyIds) {
            const entity = this.entityManager.entities.get(id);
            if (!entity) continue;

            const health = entity.components.get('Health');
            const stats = entity.components.get('BaseStats');
            const damage = 200;

            if (health) health.takeDamage(damage);
            if (stats) stats.takeDamage(damage);

            const t = entity.components.get('Transform');
            if (t) {
                this.eventBus.emitDeferred('SPAWN_FLOATING_TEXT', {
                    x: t.x, y: t.y,
                    text: `-${damage}`,
                    color: '#ffff00',
                    options: { size: 18, vy: -2.5 }
                });
            }
        }

        this.eventBus.emitDeferred('SPAWN_PARTICLES', { 
            type: 'spark', 
            x, y, 
            count: 15, 
            color: '#fffacd' 
        });
    }

    /** 🧲 자석: 떨어진 아이템들을 커서 방향으로 끌어당김 */
    _applyMagnet(x, y, radius) {
        const nearbyIds = this.spatialHash.query(x, y, radius);
        for (const id of nearbyIds) {
            const entity = this.entityManager.entities.get(id);
            if (!entity) continue;

            const droppedItem = entity.components.get('DroppedItem');
            const transform = entity.components.get('Transform');
            
            if (droppedItem && transform) {
                // 커서 방향으로 부드럽게 이동 (dt 반영)
                const dx = x - transform.x;
                const dy = y - transform.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq > 25) { // 5px 이상 거리일 때만
                    const dist = Math.sqrt(distSq);
                    const speed = 400; // px/s
                    const moveAmount = Math.min(dist, speed * this.lastDt);
                    
                    const oldX = transform.x;
                    const oldY = transform.y;
                    
                    transform.x += (dx / dist) * moveAmount;
                    transform.y += (dy / dist) * moveAmount;

                    // 공간 해시 업데이트 (이전 위치 제거 후 새 위치 삽입)
                    this.spatialHash.remove(id, oldX, oldY, true);
                    this.spatialHash.insert(id, transform.x, transform.y, true);
                }
            }
        }
    }

    /** ✨ 축복: 체력 회복 및 비옥도 증가 */
    _applyBless(x, y, radius) {
        const nearbyIds = this.spatialHash.query(x, y, radius);
        for (const id of nearbyIds) {
            const entity = this.entityManager.entities.get(id);
            const health = entity?.components.get('Health');
            if (health) {
                health.current = Math.min(health.max, health.current + 50);
            }
        }

        // 지형 비옥도 가점 (TerrainGen에 기능이 있다면)
        this.eventBus.emitDeferred('SPAWN_PARTICLES', { 
            type: 'bless', 
            x, y, 
            count: 10, 
            color: '#00ff7f' 
        });
    }

    /** 💀 재앙: 범위 내 모든 생명체 제거 (Clean up용) */
    _applyDisaster(x, y, radius) {
        const nearbyIds = this.spatialHash.query(x, y, radius);
        for (const id of nearbyIds) {
            const entity = this.entityManager.entities.get(id);
            if (entity && entity.components.has('Civilization')) {
                this.entityManager.removeEntity(id);
            }
        }
    }
}
