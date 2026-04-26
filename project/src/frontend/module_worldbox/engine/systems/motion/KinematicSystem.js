export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;

        for (const [id, entity] of em.entities) {
            const transform = entity.components.get('Transform');
            if (transform) {
                // 1. Move based on velocity
                if (transform.vx !== undefined) {
                    transform.x += transform.vx * dt;
                    transform.y += transform.vy * dt;

                    // 2. Friction / Drag
                    transform.vx *= 0.92;
                    transform.vy *= 0.92;

                    // 3. World Boundary Constraints
                    if (transform.x < 0) { transform.x = 0; transform.vx *= -0.5; }
                    if (transform.x > mw) { transform.x = mw; transform.vx *= -0.5; }
                    if (transform.y < 0) { transform.y = 0; transform.vy *= -0.5; }
                    if (transform.y > mh) { transform.y = mh; transform.vy *= -0.5; }
                }
            }
        }
    }
}
