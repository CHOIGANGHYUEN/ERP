export default class BehaviorSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        for (const [id, entity] of em.entities) {
            const state = entity.components.get('AIState');
            const transform = entity.components.get('Transform');
            const animal = entity.components.get('Animal');

            if (state && transform && animal) {
                this.updateEntityAI(id, state, transform, animal, dt);
            }
        }
    }

    updateEntityAI(id, state, transform, animal, dt) {
        // Only run wander logic if not currently eating/hunting
        if (state.mode === 'wander') {
            // Apply slight random force for wandering
            if (Math.random() < 0.1) {
                const angle = Math.random() * Math.PI * 2;
                const force = animal.type === 'sheep' ? 0.8 : 1.2;
                transform.vx += Math.cos(angle) * force;
                transform.vy += Math.sin(angle) * force;
            }

            // Occasional pause
            if (Math.random() < 0.01) {
                transform.vx *= 0.1;
                transform.vy *= 0.1;
            }
        }
    }
}