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
        this.workerVillageStats = []; // 🚀 워커로부터 받은 통계 저장소
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
            
            // entityCount는 워커가 보내준 값을 우선 사용 (없으면 로컬 측정)
            if (!this.workerVillageStats || this.workerVillageStats.length === 0) {
                this.entityCount = this.engine.entityManager.entities.size;
            }

            if (this.onUpdate) {
                this.onUpdate({ 
                    fps: this.fps,
                    entityCount: this.entityCount,
                    totalFertility: this.allocatedFertility,
                    totalMaxFertility: this.maxPotentialFertility,
                    villages: this.workerVillageStats || []
                });
            }
        }
    }
}