import System from '../../core/System.js';
import Pathfinder from '../../utils/Pathfinder.js';

export default class ConstructionSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        
        // 🏗️ 건설 로직 최적화: 건축가 역할을 수행 중인 인간들만 필터링
        for (const [id, entity] of em.entities) {
            const builder = entity.components.get('Builder');
            const transform = entity.components.get('Transform');
            const state = entity.components.get('AIState');

            if (builder && transform && state && state.mode === 'build') {
                const targetId = state.targetId;
                if (!targetId) {
                    state.mode = 'wander';
                    continue;
                }

                const target = em.entities.get(targetId);
                if (!target) {
                    state.mode = 'wander';
                    state.targetId = null;
                    continue;
                }

                const targetPos = target.components.get('Transform');
                const structure = target.components.get('Structure');
                
                if (!structure || structure.isComplete) {
                    state.mode = 'wander';
                    state.targetId = null;
                    continue;
                }

                // 거리 계산 (최적화: sqrt 대신 distSq 사용)
                const dx = targetPos.x - transform.x;
                const dy = targetPos.y - transform.y;
                const distSq = dx * dx + dy * dy;

                if (distSq <= 625) { // 반경 25px (사거리 소폭 증가로 안정성 확보)
                    // 멈춰서 건설 전념
                    transform.vx *= 0.8;
                    transform.vy *= 0.8;
                    
                    // 🪵 자원 체크 (마을 자원 연동 전까지는 무제한 혹은 소량 소모 시뮬레이션)
                    // 향후 Village.resources와 연동 예정
                    
                    const builderComp = entity.components.get('Builder');
                    const buildSpeed = builderComp ? (builderComp.buildSpeed || 10) : 10;
                    const progressAmount = buildSpeed * dt;
                    
                    if (!isNaN(progressAmount)) {
                        structure.progress += progressAmount;
                        
                        // 🔨 건설 애니메이션 효과 (먼지 파티클)
                        if (Math.random() < 0.1) {
                            this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                                x: transform.x, y: transform.y, count: 2, type: 'DUST', color: '#d7ccc8', speed: 1
                            });
                        }
                    }

                    if (structure.progress >= structure.maxProgress) {
                        this.finalizeBuilding(target, targetId, structure);
                    }
                } else {
                    // 청사진을 향해 이동 (경로 탐색 적용)
                    Pathfinder.followPath(transform, state, targetPos, 70, em);
                }
            }
        }
    }

    /** 🎊 건물 완성 및 시스템 반영 */
    finalizeBuilding(target, targetId, structure) {
        structure.progress = structure.maxProgress;
        structure.isComplete = true;
        structure.isBlueprint = false;
        
        const visual = target.components.get('Visual');
        if (visual) {
            visual.alpha = 1.0;
            // 완성된 건물 색상 강화 (선택적)
        }

        const targetPos = target.components.get('Transform');
        if (targetPos && this.engine.terrainGen) {
            this.engine.terrainGen.setOccupancy(targetPos.x, targetPos.y, 2);
        }

        console.log(`✅ Construction Complete: ${structure.type} (ID: ${targetId})`);
        
        this.eventBus.emit('BUILDING_COMPLETE', { id: targetId, type: structure.type });
        this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
            x: targetPos.x, y: targetPos.y, count: 30, type: 'EFFECT', color: '#ffeb3b', speed: 8
        });
    }
}
