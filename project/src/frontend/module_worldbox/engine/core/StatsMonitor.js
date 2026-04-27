export default class StatsMonitor {
    constructor(engine) {
        this.engine = engine;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.entityCount = 0;
        
        this.allocatedFertility = 0;
        this.maxPotentialFertility = 0;

        this.onUpdate = null;
    }

    updateFertilityStat(oldVal, newVal) { 
        this.allocatedFertility += (newVal - oldVal); 
    }
    
    updatePotentialStat(oldMax, newMax) { 
        this.maxPotentialFertility += (newMax - oldMax); 
    }

    setInitialFertility(allocated, potential) {
        this.allocatedFertility = allocated;
        this.maxPotentialFertility = potential;
    }

    update(time) {
        this.frameCount++;
        if (time - this.lastFpsUpdate > 1000) {
            this.fps = Math.round(this.frameCount);
            this.frameCount = 0;
            this.lastFpsUpdate = time;
            this.entityCount = this.engine.entityManager.entities.size;

            if (this.onUpdate) {
                this.onUpdate({ 
                    fps: this.fps,
                    entityCount: this.entityCount,
                    totalFertility: this.allocatedFertility,
                    totalMaxFertility: this.maxPotentialFertility
                });
            }
        }
    }
}