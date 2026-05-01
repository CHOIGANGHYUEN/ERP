import State from './State.js';
import { AnimalStates, DietType } from '../../../components/behavior/State.js';


export default class WanderState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        const stats = entity.components.get('BaseStats');

        // 1. 상태 전이 조건 체크
        if (stats) {
            // 매우 피곤하면 잠자기
            if (stats.fatigue > 85) return AnimalStates.SLEEP;

            // 허기 체크 및 먹이 탐색 (3초마다 1번씩 탐색 시도하여 성능 최적화)
            if (stats.hunger < 60) {
                state.searchCooldown = (state.searchCooldown || 0) - dt;

                if (state.searchCooldown <= 0) {
                    // 탐색 범위 대폭 확장 (기본 300px, 굶주릴수록 더 멀리 탐색)
                    const searchRadius = 300 + (60 - stats.hunger) * 5;
                    state.targetId = this.system.foodSensor.findFood(animal, transform.x, transform.y, searchRadius);


                    if (state.targetId) {
                        state.searchCooldown = 0;
                        // 식성에 따라 사냥(HUNT)과 채집(FORAGE) 상태를 분리
                        return (animal.diet === DietType.HERBIVORE) ? AnimalStates.FORAGE : AnimalStates.HUNT;
                    }


                    // 실패 시 2~3초 쿨다운
                    state.searchCooldown = 2.0 + Math.random();
                }
            }
        }


        // 2. 방황(Wander) 패턴 로직 (지형 인식 기능 탑재)
        if (state.wanderAngle === undefined) state.wanderAngle = Math.random() * Math.PI * 2;

        // 🗺️ [Terrain Awareness] 전방 지형 체크 및 회피
        const engine = this.system.engine;
        const terrain = engine.terrainGen;
        const checkDist = 30; // 30px 앞을 미리 내다봄
        const nextX = transform.x + Math.cos(state.wanderAngle) * checkDist;
        const nextY = transform.y + Math.sin(state.wanderAngle) * checkDist;

        // 맵 경계 체크 및 이동 가능 여부 확인
        const isOutOfBounds = nextX < 0 || nextX >= engine.mapWidth || nextY < 0 || nextY >= engine.mapHeight;
        // 🧠 [Scoring-Based Navigation] 1초마다 최적의 지형 탐색
        state.navTimer = (state.navTimer || 0) - dt;
        
        if (state.navTimer <= 0 || state.wanderAngle === undefined) {
            state.navTimer = 1.0; // ⏱️ 정확히 1초마다 탐색 진행
            
            const engine = this.system.engine;
            const terrain = engine.terrainGen;
            const samples = 8; // 8개 방향 샘플링
            const checkDist = 40; // 40px 앞을 내다봄
            
            let bestScore = -Infinity;
            let bestAngle = state.wanderAngle || Math.random() * Math.PI * 2;
            
            for (let i = 0; i < samples; i++) {
                const angle = (i / samples) * Math.PI * 2;
                const tx = transform.x + Math.cos(angle) * checkDist;
                const ty = transform.y + Math.sin(angle) * checkDist;
                
                let score = 0;
                
                // 맵 경계 체크
                if (tx < 0 || tx >= engine.mapWidth || ty < 0 || ty >= engine.mapHeight) {
                    score = -500;
                } else {
                    const biomeId = terrain.getBiomeAt(Math.floor(tx), Math.floor(ty));
                    
                    // 바이옴별 점수 산정
                    switch (biomeId) {
                        case 6: // GRASS
                        case 7: // JUNGLE
                            score = 20; break;
                        case 5: // DIRT
                            score = 15; break;
                        case 4: // SAND
                            score = 5; break;
                        case 8: // LOW MOUNTAIN
                        case 9: // HIGH MOUNTAIN
                        case 12: // SNOW
                            score = -100; break;
                        case 0: // DEEP OCEAN
                        case 1: // OCEAN
                        case 10: // RIVER
                        case 11: // LAKE
                            score = -200; break;
                        default:
                            score = 0;
                    }
                }
                
                // 현재 진행 방향 가중치 (관성 유지로 부드러운 이동 유도)
                if (state.wanderAngle !== undefined) {
                    const diff = Math.abs(angle - state.wanderAngle);
                    if (diff < 0.5) score += 5;
                }
                
                // 무작위성 가중치 (고착화 방지)
                score += Math.random() * 5;

                if (score > bestScore) {
                    bestScore = score;
                    bestAngle = angle;
                }
            }
            
            state.wanderAngle = bestAngle;
        }

        // 실제 이동 힘 적용
        const mass = transform.mass || 50;
        const force = 12000;
        transform.vx += (Math.cos(state.wanderAngle) * force * dt) / mass;
        transform.vy += (Math.sin(state.wanderAngle) * force * dt) / mass;

        return null;
    }
}
