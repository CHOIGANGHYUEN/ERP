import State from './State.js';

export default class ConsumeState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        const metabolism = entity.components.get('Metabolism');

        if (!state.targetId || !transform || !animal || !metabolism) {
            return 'idle'; // Lost target or invalid state
        }

        const target = this.engine.entityManager.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return 'idle'; // Food disappeared
        }

        const targetPos = target.components.get('Transform');
        if (!targetPos) {
            state.targetId = null;
            return 'idle';
        }

        const dx = targetPos.x - transform.x;
        const dy = targetPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // If close enough, eat it
        if (distSq < 16) {
            this.consume(entityId, state.targetId, metabolism);
            state.targetId = null;
            transform.vx = 0; 
            transform.vy = 0;
            return 'idle'; // Done eating
        } 
        
        // Otherwise, move towards food
        const dist = Math.sqrt(distSq);
        const config = this.engine.speciesConfig[animal.type];
        const speed = config ? config.moveSpeed : 45;
        
        transform.vx = (dx / dist) * speed;
        transform.vy = (dy / dist) * speed;

        return null; // Stay in consume state
    }

    consume(myId, targetId, metabolism) {
        const food = this.engine.entityManager.entities.get(targetId);
        if (food) {
            const visual = food.components.get('Visual');
            const nutrition = visual && visual.quality ? visual.quality : 0.5;
            metabolism.stomach = Math.min(metabolism.maxStomach || 2.0, metabolism.stomach + nutrition);
            this.engine.entityManager.removeEntity(targetId);
        }
    }
}