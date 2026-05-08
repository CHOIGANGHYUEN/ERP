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
        this.systemTimings = {}; // 🚀 [Step 30] 시스템별 실행 시간 저장
    }

    setSystemTiming(name, ms) {
        this.systemTimings[name] = ms;
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
                            tasks: tasks.slice(0, 5),
                            territoryList: Array.from(village.territory),
                            centerX: village.centerX,
                            centerY: village.centerY,
                            buildings: Array.from(village.buildings)
                        });
                    }
                }

                const nationStats = [];
                const nationSystem = this.engine.systemManager.nationSystem;
                if (nationSystem && nationSystem.nations) {
                    for (const nation of nationSystem.nations.values()) {
                        const diplomacy = nationSystem.getNationDiplomacy
                            ? nationSystem.getNationDiplomacy(nation.id)
                            : [];
                        const nationVillages = Array.from(nation.villages || []).map(villageId => {
                            const village = civSystem?.villages?.get(villageId);
                            return village ? {
                                id: village.id,
                                name: village.name,
                                population: village.members?.size || 0,
                                territorySize: village.territory?.size || 0,
                                loyalty: Math.round(village.loyalty ?? 70),
                                unrest: Math.round(village.unrest || 0)
                            } : null;
                        }).filter(Boolean);
                        nationStats.push({ 
                            id: nation.id, 
                            name: nation.name,
                            color: nation.color,
                            population: nation.totalPopulation || 0,
                            villageCount: nation.villages.size || 0,
                            territorySize: nation.territorySize || 0,
                            stability: Math.round(nation.stability ?? 70),
                            averageLoyalty: Math.round(nation.averageLoyalty ?? 70),
                            wars: Array.from(nation.atWarWith || []),
                            allies: Array.from(nation.allies || []),
                            hostiles: Array.from(nation.hostiles || []),
                            diplomacy,
                            villages: nationVillages,
                            resources: { ...nation.resources },
                            taxRate: nation.taxRate || 0,
                            prestige: Math.floor(nation.prestige || 0),
                            tech: Math.floor(nation.tech || 0),
                            culture: Math.floor(nation.culture || 0),
                            tributeLedger: (nation.tributeLedger || []).slice(-6)
                        });
                    }
                }

                const cm = this.engine.chunkManager;
                const viewport = this.engine.camera.getViewportBounds();
                const visibleChunks = cm.getVisibleChunks(viewport);
                const currentLOD = this.engine.camera.zoom > 0.4 ? 1 : 0;

                const em = this.engine.entityManager;
                const bufferMemory = (
                    em.transformBuffer.byteLength +
                    em.velocityBuffer.byteLength +
                    em.statsBuffer.byteLength +
                    em.statsFloatBuffer.byteLength +
                    em.stateBuffer.byteLength +
                    em.renderBuffer.byteLength +
                    em.tagBuffer.byteLength +
                    em.aliveBuffer.byteLength
                ) / (1024 * 1024); // MB

                this.onUpdate({ 
                    fps: this.fps,
                    entityCount: this.entityCount,
                    totalFertility: this.allocatedFertility,
                    totalMaxFertility: this.maxPotentialFertility,
                    villages: villageStats,
                    nations: nationStats,
                    chunkStats: {
                        visible: visibleChunks.length,
                        total: cm.chunks.length,
                        activeCanvases: cm.activeCanvasCount,
                        maxActive: cm.maxActiveCanvases,
                        lod: currentLOD,
                        drawCalls: visibleChunks.length
                    },
                    systemTimings: this.systemTimings,
                    dodStats: {
                        bufferMemoryMB: bufferMemory.toFixed(2),
                        maxEntities: em.maxEntities,
                        pooledIds: em.freeIds.length
                    }
                });
            }
        }
    }
}
