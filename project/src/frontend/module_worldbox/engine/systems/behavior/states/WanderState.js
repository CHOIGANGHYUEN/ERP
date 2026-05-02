import State from './State.js';
import { AnimalStates, DietType } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

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

        // 2. 방황 패턴 로직 (Pathfinder 기반으로 완전 교체)
        if (!state.wanderTarget) {
            const engine = this.system.engine;
            const terrain = engine.terrainGen;
            const checkDist = 80 + Math.random() * 150; // 배회 거리 설정 (너무 멀면 잦은 연산 낭비)
            
            // 이동 가능한 유효한 목적지 찾기 시도
            let found = false;
            let bestScore = -Infinity;
            let bestTarget = null;
            
            for (let i = 0; i < 8; i++) {
                const angle = Math.random() * Math.PI * 2;
                const tx = transform.x + Math.cos(angle) * checkDist;
                const ty = transform.y + Math.sin(angle) * checkDist;
                
                if (tx >= 0 && tx < engine.mapWidth && ty >= 0 && ty < engine.mapHeight) {
                    if (terrain && terrain.isNavigable(tx, ty)) {
                        const biomeId = terrain.getBiomeAt(Math.floor(tx), Math.floor(ty));
                        let score = Math.random() * 10;
                        if (biomeId === 6 || biomeId === 7) score += 20; // 잔디, 정글 선호
                        if (biomeId === 5) score += 10; // 흙
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestTarget = { x: tx, y: ty };
                        }
                    }
                }
            }
            
            if (bestTarget) {
                state.wanderTarget = bestTarget;
                state.targetId = 'wander_pos';
                state.path = null; // 새로운 목적지이므로 즉시 재탐색 유도
            } else {
                return 'idle'; // 주변에 갈 곳이 없으면 잠시 대기
            }
        }

        // Pathfinder를 통한 정확한 목적지 추적
        // 일반적인 걷기 속도 (속도가 40 미만이면 걷기 모션이 적용됨)
        const speed = 35; 
        const isReached = Pathfinder.followPath(transform, state, state.wanderTarget, speed, this.system.engine);
        
        // 🛑 목표에 도착했거나, 길을 찾지 못해 Pathfinder가 목표를 포기(targetId = null)한 경우
        if (isReached || state.targetId === null) {
            state.wanderTarget = null;
            state.targetId = null;
            return 'idle'; // 이동 완료 후 대기(Idle) 상태로 전환
        }

        return null;
    }
}
