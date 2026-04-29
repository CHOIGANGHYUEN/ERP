import System from '../../core/System.js';

export default class ProgressSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.checkTimer = 0;
    }

    update(dt, time) {
        this.checkTimer -= dt;
        if (this.checkTimer > 0) return;
        this.checkTimer = 5.0; // 5초마다 문명 발전 상태 체크 (부하 방지)

        const em = this.entityManager;
        let humanCount = 0;
        let totalWood = 0;

        // 인구수 및 모인 자원(목재) 통계
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            if (animal && animal.type === 'human') {
                humanCount++;
                const inv = entity.components.get('Inventory');
                if (inv) totalWood += (inv.items.wood || 0);
            }
        }

        // 인간이 없으면 발전 중단
        if (humanCount === 0) return;

        // 문명 상태 업데이트를 위해 모든 인간 엔티티 조사 및 새 건물 청사진 계획
        for (const [id, entity] of em.entities) {
            const civ = entity.components.get('Civilization');
            if (civ) {
                const nextLevel = civ.techLevel + 1;
                const nextTech = this.engine.techTreeConfig[nextLevel];

                if (nextTech) {
                    const req = nextTech.requirements;
                    if (humanCount >= req.population && (req.wood === undefined || totalWood >= req.wood)) {
                        // 기술 발전 조건 충족
                        civ.techLevel = nextLevel;
                        this.eventBus.emit('CIVILIZATION_PROGRESS', { level: nextLevel, name: nextTech.name });
                    }
                }

                // AIState 검사해서 건설 로직 발동 (단, 배고프지 않을 때)
                const state = entity.components.get('AIState');
                const metabolism = entity.components.get('Metabolism');
                const inventory = entity.components.get('Inventory');
                const tPos = entity.components.get('Transform');

                if (state && state.mode === 'wander' && metabolism && metabolism.stomach > metabolism.maxStomach * 0.4 && tPos) {
                    
                    // 건축 조건: 나무가 충분히 있는가?
                    if (civ.techLevel >= 0 && inventory && inventory.items.wood >= 10 && Math.random() < 0.2) {
                        // 청사진 찾기
                        let blueprintId = this.findBlueprint(tPos.x, tPos.y);
                        
                        if (blueprintId) {
                            state.mode = 'build';
                            state.targetId = blueprintId;
                        } else if (inventory.items.wood >= 30) {
                            // 없으면 새로 생성 (무작위 건물 종류 - 기술 레벨에 맞춤)
                            let buildType = 'camp';
                            if (civ.techLevel >= 1 && inventory.items.wood >= 100 && Math.random() < 0.3) {
                                buildType = 'house';
                            }
                            
                            // 주변의 무작위 위치
                            const spawnX = tPos.x + (Math.random() - 0.5) * 100;
                            const spawnY = tPos.y + (Math.random() - 0.5) * 100;
                            
                            blueprintId = this.engine.buildingFactory.createBlueprint(buildType, spawnX, spawnY);
                            if (blueprintId) {
                                state.mode = 'build';
                                state.targetId = blueprintId;
                            }
                        }
                    } else if (state.mode === 'wander' && Math.random() < 0.3 && inventory.items.wood < 50) {
                        // 나무가 없으면 나무를 채집하는 모드로 전환 (새로운 State 필요)
                        state.mode = 'gather_wood';
                    }
                }
            }
        }
    }

    findBlueprint(x, y) {
        const em = this.entityManager;
        let nearestId = null;
        let minDistSq = 100000; // 반경 약 300px 이내

        for (const [id, entity] of em.entities) {
            const structure = entity.components.get('Structure');
            if (structure && !structure.isComplete) {
                const tPos = entity.components.get('Transform');
                if (tPos) {
                    const dx = tPos.x - x;
                    const dy = tPos.y - y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        nearestId = id;
                    }
                }
            }
        }
        return nearestId;
    }
}
