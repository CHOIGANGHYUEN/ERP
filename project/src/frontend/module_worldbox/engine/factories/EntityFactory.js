export default class EntityFactory {
    constructor(engine) {
        this.engine = engine;
    }

    createAnimal(type, x, y, options = {}) {
        const em = this.engine.entityManager;
        const config = this.engine.speciesConfig[type];
        if (!config) return null;

        const id = em.createEntity();
        const entity = em.entities.get(id);
        
        entity.components.set('Transform', { x, y, vx: 0, vy: 0 });
        
        entity.components.set('Visual', { 
            type: type,
            size: options.isBaby ? 0.6 : 1.0 
        });
        
        entity.components.set('Animal', { 
            type: type, 
            isBaby: options.isBaby || false, 
            diet: config.diet || 'herbivore', 
            herdId: -1 
        });
        
        entity.components.set('Metabolism', { 
            stomach: options.isBaby ? 0 : (config.maxStomach || 3.0) * 0.4, 
            maxStomach: config.maxStomach || 3.0, 
            digestionSpeed: config.digestionSpeed || 0.15,
            storedFertility: 0, 
            isPooping: false 
        });
        
        entity.components.set('AIState', { mode: 'wander', targetId: null });

        if (type === 'human') {
            entity.components.set('Civilization', { techLevel: 0, villageId: -1 });
        }

        return id;
    }

    createResource(type, x, y, quality = 1.0, options = {}) {
        const em = this.engine.entityManager;
        const id = em.createEntity();
        const entity = em.entities.get(id);

        entity.components.set('Transform', { x, y });

        if (type === 'grass') {
            let r, g, b;
            if (quality > 0.8) { r = 46; g = 150; b = 30; }
            else if (quality > 0.4) { r = 139; g = 195; b = 74; }
            else { r = 180; g = 180; b = 60; }
            
            entity.components.set('Visual', { 
                color: `rgb(${r},${g},${b})`,
                quality: quality 
            });
            entity.components.set('Resource', { type: 'food', value: Math.floor(quality * 10), edible: true, isGrass: true });
        } 
        else if (type === 'flower') {
            const colors = ['#ff5252', '#ff4081', '#ffeb3b', '#e040fb', '#ffffff'];
            const petalColor = colors[Math.floor(Math.random() * colors.length)];
            
            entity.components.set('Visual', { 
                type: 'flower',
                color: petalColor,
                quality: quality
            });
            entity.components.set('Resource', { 
                type: 'food', 
                value: Math.floor(quality * 15), 
                edible: true, 
                isFlower: true 
            });
        }
        else if (type === 'tree') {
            entity.components.set('Visual', {
                type: 'tree',
                quality: quality, // Will represent thickness
                subtype: options.subtype || 'normal' // normal, fruit, beehive
            });
            entity.components.set('Resource', {
                type: 'wood',
                value: Math.floor(quality * 20),
                edible: false,
                isTree: true
            });
            // If it's a fruit tree or beehive, maybe it can also provide food over time
            if (options.subtype === 'fruit' || options.subtype === 'beehive') {
                entity.components.get('Resource').foodValue = 50;
            }
        }
        else if (type === 'poop') {
            entity.components.set('Visual', { type: 'poop' });
            entity.components.set('Resource', { isFertilizer: true, amount: 100 });
        }

        return id;
    }
}