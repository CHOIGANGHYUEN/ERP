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
                // 🏘️ 마을 통계 수집 (고도화된 정보 포함)
                const villageStats = [];
                const civSystem = this.engine.systemManager.civilization || this.engine.systemManager.villageSystem;
                
                if (civSystem && civSystem.villages) {
                    for (const [vId, village] of civSystem.villages) {
                        // 📊 리소스 및 필요량 집계
                        const wood = village.resources?.wood || 0;
                        const food = village.resources?.food || 0;
                        const woodNeed = village.resourceNeeds?.wood || 0;
                        const foodNeed = village.resourceNeeds?.food || 0;

                        // 📋 할일 목록(TaskBoard) 요약
                        const tasks = village.taskBoard || [];
                        const taskStats = {
                            total: tasks.length,
                            available: tasks.filter(t => t.status === 'AVAILABLE').length,
                            inProgress: tasks.filter(t => t.status === 'CLAIMED').length,
                            build: tasks.filter(t => t.type === 'build').length,
                            gather: tasks.filter(t => t.type.startsWith('gather') || t.type === 'hunt').length
                        };

                        // 👑 촌장 정보
                        const chief = this.engine.entityManager.entities.get(village.chiefId);
                        const chiefName = chief?.name || 'Vacant';

                        villageStats.push({
                            id: vId,
                            name: village.name || `Village ${vId}`,
                            population: village.members?.size || 0,
                            chiefId: village.chiefId,
                            chiefName: chiefName,
                            food: Math.floor(food),
                            wood: Math.floor(wood),
                            foodNeed: Math.floor(foodNeed),
                            woodNeed: Math.floor(woodNeed),
                            houses: Array.from(village.buildings).filter(bId => {
                                const b = this.engine.entityManager.entities.get(bId);
                                return b?.components.get('Structure')?.type === 'house';
                            }).length,
                            taskStats: taskStats,
                            tasks: tasks.slice(0, 5) // 최근/우선순위 높은 과업 일부 전달
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