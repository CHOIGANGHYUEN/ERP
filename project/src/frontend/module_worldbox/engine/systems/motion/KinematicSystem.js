export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;
        // 2. 이동 및 물리 처리 (오직 동물 개체만 물리 연산 수행)
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const transform = entity.components.get('Transform');
            if (transform && transform.vx !== undefined) {
                // 2a. 속도에 따른 이동 (dt 보정)
                transform.x += transform.vx * dt;
                transform.y += transform.vy * dt;

                // 2b. 마찰/저항 (속도 감쇠 완화: 0.92 -> 0.96)
                transform.vx *= 0.96;
                transform.vy *= 0.96;

                // 2c. 월드 경계 제약 (튕겨나가기 방지)
                if (transform.x < 0) { transform.x = 0; transform.vx *= -0.5; }
                if (transform.x > mw) { transform.x = mw; transform.vx *= -0.5; }
                if (transform.y < 0) { transform.y = 0; transform.vy *= -0.5; }
                if (transform.y > mh) { transform.y = mh; transform.vy *= -0.5; }
            }
        }
    }
}
