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
                    state.targetId = this.system.findFood(animal, transform.x, transform.y, searchRadius);

                    
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


        // 2. 방황(Wander) 패턴 로직
        if (state.wanderAngle === undefined) state.wanderAngle = Math.random() * Math.PI * 2;

        if (Math.random() < 0.05) {
            state.wanderAngle += (Math.random() - 0.5) * Math.PI;
        }

        const mass = transform.mass || 50;
        const force = 10000; 
        transform.vx += (Math.cos(state.wanderAngle) * force * dt) / mass;
        transform.vy += (Math.sin(state.wanderAngle) * force * dt) / mass;

        return null;
    }
}

