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
                // 🏘️ 마을 통계 수집
                const villageStats = [];
                const civSystem = this.engine.systemManager.civilization;
                if (civSystem && civSystem.villages) {
                    for (const [vId, village] of civSystem.villages) {
                        const blackboard = this.engine.systemManager.blackboard;
                        const storages = blackboard?.storages?.filter(s => s.villageId === vId) || [];
                        const totalFood = storages.reduce((sum, s) => sum + (s.items['food'] || 0), 0);
                        const totalWood = storages.reduce((sum, s) => sum + (s.items['wood'] || 0), 0);
                        
                        villageStats.push({
                            id: vId,
                            name: village.name || `Village ${vId}`,
                            population: village.members?.size || 0,
                            food: Math.floor(totalFood),
                            wood: Math.floor(totalWood),
                            houses: village.buildings?.filter(b => b.type === 'house').length || 0
                        });
                    }
                }

                this.onUpdate({ 
                    fps: this.fps,
                    entityCount: this.entityCount,
                    totalFertility: this.allocatedFertility,
                    totalMaxFertility: this.maxPotentialFertility,
                    villages: villageStats
                });
            }
        }
    }
}