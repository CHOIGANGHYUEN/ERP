import System from '../../core/System.js';
import speciesConfig from '../../config/species.json';

export default class ReproductionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
    }

    update(dt, time) {
        const em = this.entityManager;
        for (const [id, entity] of this.entityManager.entities) {
            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            const transform = entity.components.get('Transform');

            if (animal && metabolism && transform) {
                // 1. 아기 성장 처리
                if (animal.isBaby) {
                    animal.age = (animal.age || 0) + dt;
                    if (animal.age > 40) { // 40초 후 어른으로 성장
                        animal.isBaby = false;
                        const visual = entity.components.get('Visual');
                        if (visual) visual.size = 1.0; // 원래 크기로 복구
                        const config = speciesConfig[animal.type];
                        if (config && transform.mass) {
                            transform.mass = config.weight; // 어른의 체급(무게)으로 복구
                        }
                    }
                }

                // 벌은 BehaviorSystem에 별도의 여왕벌 번식 로직이 있으므로 제외
                if (animal.type === 'bee') continue;

                const config = speciesConfig[animal.type];
                if (!config || !config.reproductionThreshold) continue;

                // 2. 어른 동물의 번식 (위장 포만감이 번식 임계치 이상일 때)
                if (!animal.isBaby && metabolism.stomach >= config.reproductionThreshold) {
                    // 쿨타임 감소 및 체크
                    if (animal.reproductionCooldown > 0) {
                        animal.reproductionCooldown -= dt;
                        continue;
                    }

                    // 무리 내 개체수 제한 체크 (과도한 번식 방지)
                    // 타 시스템 의존성(SocialSystem) 제거: 개체수는 독립적으로 모니터링되거나 Event로 검증해야 함

                    // 전체 월드 엔티티 제한 (최적화 방어)
                    if (em.entities.size > 20000) continue;

                    // 확률적 번식 성공 (1초당 5% 확률)
                    if (Math.random() < 0.05 * dt) {
                        // 번식 시 막대한 에너지를 소모 (포만감 대폭 하락)
                        metabolism.stomach -= (config.maxStomach * 0.4);
                        animal.reproductionCooldown = 40; // 40초의 번식 쿨타임

                        // 새끼 스폰
                        this.spawnBaby(animal.type, transform.x, transform.y);

                        // 하트 파티클 연출
                        this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                            x: transform.x,
                            y: transform.y,
                            count: 5,
                            type: 'EFFECT',
                            color: '#ff4081'
                        });
                    }
                }
                else if (animal.reproductionCooldown > 0) {
                    // 배가 부르지 않아도 쿨타임은 흐르게 처리
                    animal.reproductionCooldown -= dt;
                }
            }
        }
    }

    spawnBaby(type, x, y) {
        // 부모 주변의 약간 떨어진 위치에 스폰
        const spawnX = x + (Math.random() - 0.5) * 15;
        const spawnY = y + (Math.random() - 0.5) * 15;

        // EventBus를 통해 SpawnerSystem에 새끼 스폰 요청
        this.eventBus.emit('SPAWN_ENTITY', { type: type, x: spawnX, y: spawnY, isBaby: true });
    }
}