import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

export default class BeeBrain {
    constructor(entityManager, eventBus, engine, spatialHash) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.engine = engine;
        this.spatialHash = spatialHash;
    }

    /**
     * 🧠 [Decide Pattern] 벌의 행동을 판단하고 제안합니다.
     */
    decide(id, state, transform, animal, dt) {
        // 🛑 [Drag & Drop Protection] 플레이어에게 잡힌 상태면 AI 판단 중단
        if (state.mode === AnimalStates.GRABBED) return { mode: AnimalStates.GRABBED };

        // 🧠 [Decision Throttling] 벌도 1초 주기로 판단하도록 제한
        state.thinkTimer = (state.thinkTimer || 0) + dt;
        if (state.thinkTimer < 1.0 && state.mode && state.mode !== AnimalStates.IDLE && state.mode !== 'bee_inside') {
            return { mode: state.mode, targetId: state.targetId };
        }
        state.thinkTimer = 0;

        const em = this.entityManager;
        const role = animal.role || 'worker';
        const hive = em.entities.get(animal.hiveId);

        // 1. 벌집 파괴 시 처리 (즉시 상태 전이 허용)
        if (!hive && state.mode === 'bee_inside') {
            if (role !== 'worker') {
                animal.role = 'worker';
                const visual = em.entities.get(id).components.get('Visual');
                if (visual) visual.role = 'worker';
            }
            return { mode: 'bee_wander', targetId: null };
        }

        // 2. 특수 역할 (애벌레, 여왕) - 내부 상주
        if (role === 'larva' || role === 'queen') {
            if (role === 'larva') {
                animal.age = (animal.age || 0) + dt;
                if (animal.age > 20) {
                    animal.role = 'worker';
                    animal.age = 0;
                    const visual = em.entities.get(id).components.get('Visual');
                    if (visual) visual.role = 'worker';
                }
            } else {
                const hiveComp = hive?.components.get('Hive');
                if (hiveComp && hiveComp.honey >= 30) {
                    hiveComp.honey -= 30;
                    hiveComp.larvaCount += 1;
                    this.eventBus.emit('SPAWN_EFFECT_PARTICLES', { x: transform.x, y: transform.y, count: 5, type: 'EFFECT', color: '#fff176', speed: 1.5 });
                }
                if (hiveComp && hiveComp.larvaCount > 0) {
                    state.hatchTimer = (state.hatchTimer || 0) + dt;
                    if (state.hatchTimer > 10) {
                        state.hatchTimer = 0;
                        hiveComp.larvaCount -= 1;
                        this.engine.spawner.spawnBee(transform.x, transform.y, 'worker', animal.hiveId);
                    }
                }
                if (hiveComp) hiveComp.hasQueen = true;
            }
            
            if (hive) {
                const hPos = hive.components.get('Transform');
                transform.x = hPos.x; transform.y = hPos.y;
            }
            return { mode: 'bee_inside', targetId: null };
        }

        // 3. 일벌(Worker) 로직
        animal.nectar = animal.nectar || 0;
        
        // [작업 보호] 현재 꽃에서 꿀을 따는 중이거나 집으로 돌아가는 중이면 유지
        if ((state.mode === 'bee_gather' || state.mode === 'bee_return') && state.targetId) {
            return { mode: state.mode, targetId: state.targetId };
        }

        if (state.mode === 'bee_inside') {
            animal.restTimer = (animal.restTimer || 0) + dt;
            if (hive) {
                const hPos = hive.components.get('Transform');
                const hComp = hive.components.get('Hive');
                transform.x = hPos.x; transform.y = hPos.y;
                transform.vx = 0; transform.vy = 0;

                if (animal.restTimer > 3 && hComp && hComp.honey < 40) {
                    animal.restTimer = 0;
                    transform.y -= 5;
                    return { mode: 'bee_wander', targetId: null };
                }
            }
            return { mode: 'bee_inside', targetId: null };
        }

        if (state.mode === 'bee_wander') {
            // 근처의 꿀(꽃) 찾기
            if (animal.nectar < 10) {
                let targetFlower = null;
                const searchRadius = 80; // 🍯 [Reduced] 200 -> 80
                state.searchRange = searchRadius;
                this.spatialHash.eachInSpiral(transform.x, transform.y, searchRadius, (fid) => {
                    const fEnt = em.entities.get(fid);
                    if (!fEnt) return false;
                    const r = fEnt.components.get('Resource');
                    if (r && r.isFlower && r.storedFertility > 0) {
                        targetFlower = fid;
                        return true;
                    }
                    return false;
                });
                if (targetFlower) return { mode: 'bee_gather', targetId: targetFlower };
            } else if (hive) {
                return { mode: 'bee_return', targetId: hive.id };
            }
        }

        // 4. 속도 제한 적용
        const maxSpeed = role === 'larva' ? 5 : (role === 'worker' ? 45 : 20);
        const mag = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
        if (mag > maxSpeed && mag > 0) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }

        return { mode: state.mode, targetId: state.targetId };
    }
}