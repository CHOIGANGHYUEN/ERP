export default class SocialSystem {
    constructor(engine) {
        this.engine = engine;
        this.herds = new Map(); // herdId -> [entityId, ...]
        this.nextHerdId = 1;
    }

    update(dt) {
        const em = this.engine.entityManager;
        
        // 1. Cleanup dead members
        for (const [hId, members] of this.herds) {
            const alive = members.filter(mid => em.entities.has(mid));
            if (alive.length === 0) {
                this.herds.delete(hId);
            } else {
                this.herds.set(hId, alive);
            }
        }

        // 2. Assign herds & apply flocking
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            const transform = entity.components.get('Transform');
            if (animal && transform) {
                this.maintainHerd(id, animal);
                this.applyFlocking(id, animal, transform, dt);
            }
        }
    }

    maintainHerd(id, animal) {
        const config = this.engine.speciesConfig[animal.type] || {};
        const limit = config.herdLimit || 20;

        if (animal.herdId === undefined || animal.herdId === -1) {
            let found = false;
            for (const [hId, members] of this.herds) {
                if (members.length < limit) {
                    members.push(id);
                    animal.herdId = hId;
                    found = true;
                    break;
                }
            }
            if (!found) {
                const newId = this.nextHerdId++;
                this.herds.set(newId, [id]);
                animal.herdId = newId;
            }
        }
    }

    applyFlocking(myId, animal, transform, dt) {
        const members = this.herds.get(animal.herdId);
        if (!members || members.length <= 1) return;

        let centerX = 0, centerY = 0;
        let sepX = 0, sepY = 0;
        let count = 0;
        const em = this.engine.entityManager;

        for (const otherId of members) {
            if (otherId === myId) continue;
            const otherTransform = em.entities.get(otherId)?.components.get('Transform');
            if (!otherTransform) continue;

            const dx = otherTransform.x - transform.x;
            const dy = otherTransform.y - transform.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 2500) { // 50px radius
                centerX += otherTransform.x;
                centerY += otherTransform.y;
                count++;
                
                if (distSq < 400) { // 20px Separation
                    const dist = Math.sqrt(distSq);
                    sepX -= dx / dist;
                    sepY -= dy / dist;
                }
            }
        }

        if (count > 0) {
            centerX /= count;
            centerY /= count;
            
            const timeScale = dt * 60; 

            // Cohesion (Stronger force towards center)
            transform.vx += (centerX - transform.x) * 0.15 * timeScale;
            transform.vy += (centerY - transform.y) * 0.15 * timeScale;
            
            // Separation (Stronger avoidance)
            transform.vx += sepX * 1.5 * timeScale;
            transform.vy += sepY * 1.5 * timeScale;
        }

        // Behavior: Social pause
        if (Math.random() < 0.001) {
            transform.vx *= 0.1;
            transform.vy *= 0.1;
        }
    }
}
