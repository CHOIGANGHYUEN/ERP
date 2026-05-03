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
            const transform = entity.components.get('Transform');
            const state = entity.components.get('AIState');

            if (transform && state && state.mode === 'build') {
                const targetId = state.targetId;
                if (!targetId) {
                    state.mode = 'idle';
                    continue;
                }

                const target = em.entities.get(targetId);
                if (!target) {
                    state.mode = 'idle';
                    state.targetId = null;
                    continue;
                }

                const targetPos = target.components.get('Transform');
                const structure = target.components.get('Structure');
                
                if (!structure || structure.isComplete) {
                    state.mode = 'idle';
                    state.targetId = null;
                    continue;
                }

                // 거리 계산 (최적화: sqrt 대신 distSq 사용)
                const dx = targetPos.x - transform.x;
                const dy = targetPos.y - transform.y;
                const distSq = dx * dx + dy * dy;

                if (distSq <= 625) { 
                    transform.vx *= 0.5;
                    transform.vy *= 0.5;
                    
                    const inventory = entity.components.get('Inventory');
                    const woodInInv = (inventory?.items && inventory.items['wood']) || 0;

                    if (woodInInv > 0) {
                        const builderComp = entity.components.get('Builder');
                        const buildSpeed = builderComp ? (builderComp.buildSpeed || 10) : 10;
                        const progressAmount = buildSpeed * dt;
                        
                        if (!isNaN(progressAmount)) {
                            structure.progress += progressAmount;
                            inventory.items['wood'] = Math.max(0, inventory.items['wood'] - progressAmount/10);
                            
                            // 🔨 건설 애니메이션 효과 (먼지 파티클)
                            if (Math.random() < 0.1) {
                                this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                                    x: transform.x, y: transform.y, count: 2, type: 'DUST', color: '#d7ccc8', speed: 1
                                });
                            }

                            if (structure.progress >= structure.maxProgress) {
                                this.finalizeBuilding(target, targetId, structure);
                            }
                        }
                    } else {
                        // 자원이 없으면 대기 (시각적 알림)
                        if (Math.random() < 0.005) {
                            this.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId: id, text: '🪵?', duration: 1000 });
                        }
                    }
                }
            }
        }
    }

    /** 🎊 건물 완성 및 시스템 반영 */
    finalizeBuilding(target, targetId, structure) {
        try {
            structure.progress = structure.maxProgress;
            structure.isComplete = true;
            structure.isBlueprint = false;
            
            const visual = target.components.get('Visual');
            if (visual) {
                visual.alpha = 1.0;
            }

            const targetPos = target.components.get('Transform');
            if (targetPos) {
                // 1. 지형 및 점유 업데이트 (에러 발생 시 로그만 출력)
                try {
                    if (this.engine.terrainGen) {
                        this.engine.terrainGen.setOccupancy(targetPos.x, targetPos.y, 2);
                        // 건설 완료 시 해당 자리 비옥도 초기화 (건물 부지)
                        if (typeof this.engine.terrainGen.setFertility === 'function') {
                            this.engine.terrainGen.setFertility(targetPos.x, targetPos.y, 0);
                        }
                    }
                } catch (terrainErr) {
                    console.error("Terrain update failed during building completion:", terrainErr);
                }

                // 2. 🚀 [Troubleshooting] 건설에 참여한 모든 유닛 상태 초기화 (핵심 로직)
                // 이 부분은 지형 에러와 상관없이 실행되어야 함
                const buildingRadius = (visual?.size || 40) * 0.5 + 10; // 건물 크기에 따른 안전 거리

                for (const id of this.entityManager.animalIds) {
                    const entity = this.entityManager.entities.get(id);
                    if (!entity) continue;
                    
                    const state = entity.components.get('AIState');
                    if (state && state.targetId === targetId) {
                        state.mode = 'idle';
                        state.targetId = null;
                        state.path = null;

                        // 건물 밖으로 밀어내기 (끼임 방지 - 부드럽게 위치 조정)
                        const transform = entity.components.get('Transform');
                        if (transform) {
                            let dx = transform.x - targetPos.x;
                            let dy = transform.y - targetPos.y;
                            let d = Math.hypot(dx, dy);

                            // 정중앙에 있을 경우 랜덤한 방향으로 밀어내기
                            if (d < 1) {
                                const angle = Math.random() * Math.PI * 2;
                                dx = Math.cos(angle);
                                dy = Math.sin(angle);
                                d = 1;
                            }
                            
                            // 📏 건물의 반지름보다 약간 먼 곳으로 안전하게 이동
                            transform.x = targetPos.x + (dx / d) * buildingRadius; 
                            transform.y = targetPos.y + (dy / d) * buildingRadius;
                            
                            transform.vx = 0;
                            transform.vy = 0;
                        }
                    }
                }

                console.log(`✅ Construction Complete: ${structure.type} (ID: ${targetId})`);
                
                this.eventBus.emit('BUILDING_COMPLETE', { id: targetId, type: structure.type });
                this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: targetPos.x, y: targetPos.y, count: 30, type: 'EFFECT', color: '#ffeb3b', speed: 8
                });
            }
        } catch (fatalErr) {
            console.error("Fatal error in finalizeBuilding:", fatalErr);
            // 최소한 타겟이라도 풀어주기 시도
            const builders = Array.from(this.entityManager.entities.values()).filter(e => e.components.get('AIState')?.targetId === targetId);
            builders.forEach(b => {
                const s = b.components.get('AIState');
                if (s) { s.mode = 'idle'; s.targetId = null; }
            });
        }
    }
}
