import State from './State.js';
import { AnimalStates, DietType } from '../../../components/behavior/State.js';

/**
 * 🐾 WanderState (방황 상태)
 * 동물들이 목적지 없이 배회하며 지형을 탐색하는 기본 상태입니다.
 */
export default class WanderState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        const stats = entity.components.get('BaseStats');

        if (!transform || !state) return null;

        // 1. 상태 전이 조건 체크
        if (stats) {
            if (stats.fatigue > 85) return AnimalStates.SLEEP;

            if (stats.hunger < 60) {
                state.searchCooldown = (state.searchCooldown || 0) - dt;
                if (state.searchCooldown <= 0) {
                    const searchRadius = 300 + (60 - stats.hunger) * 5;
                    state.targetId = this.system.foodSensor.findFood(animal, transform.x, transform.y, searchRadius);

                    if (state.targetId) {
                        state.searchCooldown = 0;
                        return (animal.diet === DietType.HERBIVORE) ? AnimalStates.FORAGE : AnimalStates.HUNT;
                    }
                    
                    // 🧪 [Expert Optimization] 배가 고플수록 더 자주 수색하도록 쿨타임 조절
                    const baseCooldown = stats.hunger < 30 ? 0.5 : 2.0;
                    state.searchCooldown = baseCooldown + Math.random();
                }
            }
        }

        // 2. 방황 패턴 로직
        state.navTimer = (state.navTimer || 0) - dt;
        
        if (state.navTimer <= 0 || state.wanderAngle === undefined) {
            state.navTimer = 1.0; 
            
            const engine = this.system.engine;
            const terrain = engine.terrainGen;
            const samples = 8; 
            const checkDist = 40; 
            
            let bestScore = -Infinity;
            let bestAngle = state.wanderAngle || Math.random() * Math.PI * 2;
            
            for (let i = 0; i < samples; i++) {
                const angle = (i / samples) * Math.PI * 2;
                const tx = transform.x + Math.cos(angle) * checkDist;
                const ty = transform.y + Math.sin(angle) * checkDist;
                
                let score = 0;
                if (tx < 0 || tx >= engine.mapWidth || ty < 0 || ty >= engine.mapHeight) {
                    score = -500;
                } else {
                    const biomeId = terrain.getBiomeAt(Math.floor(tx), Math.floor(ty));
                    switch (biomeId) {
                        case 6: case 7: score = 20; break; // GRASS, JUNGLE
                        case 5: score = 15; break; // DIRT
                        case 4: score = 5; break; // SAND
                        case 8: case 9: case 12: score = -100; break; // MOUNTAINS, SNOW
                        case 0: case 1: case 10: case 11: score = -200; break; // WATER
                        default: score = 0;
                    }
                }
                
                if (state.wanderAngle !== undefined) {
                    const diff = Math.abs(angle - state.wanderAngle);
                    if (diff < 0.5) score += 5;
                }
                score += Math.random() * 5;

                if (score > bestScore) {
                    bestScore = score;
                    bestAngle = angle;
                }
            }
            state.wanderAngle = bestAngle;
        }

        // 🚀 [Expert Buff] 실제 이동 힘 적용
        const mass = transform.mass || 50;
        const force = 25000;
        transform.vx += (Math.cos(state.wanderAngle) * force * dt) / mass;
        transform.vy += (Math.sin(state.wanderAngle) * force * dt) / mass;

        // 🛡️ [Stuck Prevention] 이동 불가 지역 또는 건물 내부로 들어갔다면 즉시 방향 전환 유도
        const terrain = this.system.engine.terrainGen;
        const sh = this.system.engine.spatialHash;
        
        let isStuck = false;
        if (terrain && !terrain.isNavigable(transform.x, transform.y)) {
            isStuck = true;
        } else if (sh) {
            // 주변 건물 체크
            const nearby = sh.queryRect(transform.x - 10, transform.y - 10, 20, 20);
            for (const bId of nearby) {
                const b = this.system.entityManager.entities.get(bId);
                if (b && b.components.has('Building')) {
                    const bt = b.components.get('Transform');
                    const bv = b.components.get('Visual');
                    if (bt && bv) {
                        const r = (bv.size || 40) * 0.4; // 충돌 반경
                        if (Math.abs(transform.x - bt.x) < r && Math.abs(transform.y - bt.y) < r) {
                            isStuck = true;
                            // 건물 중심에서 밀어내기
                            const dx = transform.x - bt.x;
                            const dy = transform.y - bt.y;
                            const d = Math.hypot(dx, dy) || 1;
                            transform.x += (dx / d) * 10;
                            transform.y += (dy / d) * 10;
                            break;
                        }
                    }
                }
            }
        }

        if (isStuck) {
            state.navTimer = 0; // 다음 프레임에 즉시 새로운 각도 계산
            // 반대 방향으로 살짝 튕겨나가게 하여 탈출 도움
            transform.vx *= -0.8;
            transform.vy *= -0.8;
        }

        return null;
    }
}
