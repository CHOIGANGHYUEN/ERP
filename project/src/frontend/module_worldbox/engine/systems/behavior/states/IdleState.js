import State from './State.js';

export default class IdleState extends State {
    update(entityId, entity, dt) {
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        
        if (transform && animal) {
            this.wander(transform, animal, dt);
        }
        
        return null; // Stay in idle/wander
    }

    wander(transform, animal, dt) {
        // Apply slight random force for wandering
        if (!transform.vx || Math.random() < 0.05) {
            const angle = Math.random() * Math.PI * 2;
            const config = this.engine.speciesConfig[animal.type];
            const force = config ? (config.moveSpeed * 0.02) : 1.0;
            transform.vx += Math.cos(angle) * force;
            transform.vy += Math.sin(angle) * force;
        }

        // Occasional pause
        if (Math.random() < 0.02) {
            transform.vx *= 0.1;
            transform.vy *= 0.1;
        }

        // Constrain max wander speed
        const maxSpeed = 30;
        const mag = Math.sqrt(transform.vx**2 + transform.vy**2);
        if (mag > maxSpeed) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }
    }
}