import { GlobalLogger } from "../../utils/Logger";
import DroppedItem from "../../components/resource/DroppedItem.js";
import JobController from "../../components/behavior/JobController.js";
import State from "../../components/behavior/State.js";
import Visual from "../../components/render/Visual.js";
import Health from "../../components/stats/Health.js";
import Transform from "../../components/motion/Transform.js";
import Velocity from "../../components/motion/Velocity.js";
import BaseStats from "../../components/stats/BaseStats.js";
import Inventory from "../../components/resource/Inventory.js";
import Storage from "../../components/resource/Storage.js";

/**
 * 💾 SaveLoadSystem
 * 엔진의 전체 상태(지형, 엔티티, 문명, 경제 등)를 직렬화하고 복구하는 시스템입니다.
 * DB 없이 파일 내보내기(Export)와 가져오기(Import)를 지원합니다.
 */
export default class SaveLoadSystem {
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * 📤 전체 게임 상태를 JSON 객체로 직렬화합니다.
     */
    serialize() {
        const engine = this.engine;
        const em = engine.entityManager;
        const tg = engine.terrainGen;
        const ns = engine.systemManager.nationSystem;
        const vs = engine.systemManager.villageSystem;
        const zm = engine.systemManager.zoneManager;
        const time = engine.timeSystem;

        GlobalLogger.info('💾 Serializing game state...');

        const saveData = {
            version: '1.0',
            timestamp: Date.now(),
            map: {
                width: engine.mapWidth,
                height: engine.mapHeight,
                // 지형 데이터 (TypedArray -> Array)
                terrain: Array.from(tg.terrain.buffer),
                biomes: Array.from(tg.biomes.buffer),
                fertility: Array.from(tg.fertilityBuffer),
                waterQuality: Array.from(tg.waterQualityBuffer),
                mineralDensity: Array.from(tg.mineralDensityBuffer),
                territory: Array.from(tg.territoryBuffer),
                altitude: Array.from(tg.altitudeBuffer)
            },
            entities: {
                nextId: em.nextId,
                freeIds: em.freeIds,
                // 엔티티 목록 및 컴포넌트 정보
                data: Array.from(em.entities.entries()).map(([id, entity]) => ({
                    id,
                    components: Array.from(entity.components.entries()).map(([name, comp]) => ({
                        name,
                        data: this._serializeComponent(comp)
                    }))
                })),
                // DOD 버퍼
                buffers: {
                    stats: Array.from(em.statsBuffer),
                    statsFloat: Array.from(em.statsFloatBuffer),
                    state: Array.from(em.stateBuffer),
                    job: Array.from(em.jobBuffer),
                    render: Array.from(em.renderBuffer),
                    alive: Array.from(em.aliveBuffer),
                    tag: Array.from(em.tagBuffer),
                    transform: Array.from(em.transformBuffer)
                }
            },
            civilization: {
                nations: Array.from(ns.nations.entries()).map(([id, nation]) => ({
                    id: nation.id,
                    name: nation.name,
                    color: nation.color,
                    kingId: nation.kingId,
                    prestige: nation.prestige,
                    culture: nation.culture,
                    tech: nation.tech,
                    lastTechLevel: nation.lastTechLevel || 0,
                    totalPopulation: nation.totalPopulation,
                    territorySize: nation.territorySize,
                    averageLoyalty: nation.averageLoyalty || 70,
                    stability: nation.stability || 70,
                    taxRate: nation.taxRate || 0.1,
                    warScore: nation.warScore || 0,
                    resources: { ...nation.resources },
                    policies: { ...nation.policies },
                    tributeLedger: Array.from(nation.tributeLedger || []),
                    villages: Array.from(nation.villages || []),
                    atWarWith: Array.from(nation.atWarWith || []),
                    allies: Array.from(nation.allies || []),
                    hostiles: Array.from(nation.hostiles || [])
                })),
                nextNationId: ns.nextNationId,
                villages: Array.from(vs.villages.entries()).map(([id, village]) => ({
                    id: village.id,
                    name: village.name,
                    centerX: village.centerX,
                    centerY: village.centerY,
                    nationId: village.nationId,
                    type: village.type,
                    resources: { ...village.resources },
                    resourceMax: { ...village.resourceMax },
                    resourceNeeds: { ...village.resourceNeeds },
                    lastPopulation: village.lastPopulation || 0,
                    loyalty: village.loyalty,
                    unrest: village.unrest,
                    members: Array.from(village.members || []),
                    buildings: Array.from(village.buildings || []),
                    storageIds: Array.from(village.storageIds || []),
                    territory: Array.from(village.territory || [])
                })),
                nextVillageId: vs.nextVillageId,
                zones: Array.from(zm.zones.entries()).map(([id, zone]) => ({
                    id: zone.id,
                    type: zone.type,
                    villageId: zone.villageId,
                    centerX: zone.centerX,
                    centerY: zone.centerY,
                    territory: Array.from(zone.territory || []),
                    assignedWorkers: Array.from(zone.assignedWorkers || [])
                })),
                nextZoneId: zm.nextZoneId
            },
            time: {
                totalDays: time.totalDays,
                hours: time.hours,
                minutes: time.minutes,
                timeScale: time.timeScale
            }
        };

        return saveData;
    }

    /**
     * 📥 JSON 데이터를 받아 게임 상태를 복구합니다.
     */
    async deserialize(saveData) {
        if (!saveData || saveData.version !== '1.0') {
            throw new Error('Invalid or unsupported save file version.');
        }

        const engine = this.engine;
        const em = engine.entityManager;
        const tg = engine.terrainGen;
        const ns = engine.systemManager.nationSystem;
        const vs = engine.systemManager.villageSystem;
        const zm = engine.systemManager.zoneManager;
        const time = engine.timeSystem;

        GlobalLogger.info('📂 Deserializing game state...');

        // 1. 맵 데이터 복구
        engine.mapWidth = saveData.map.width;
        engine.mapHeight = saveData.map.height;

        tg.terrain.buffer.set(saveData.map.terrain);
        tg.biomes.buffer.set(saveData.map.biomes);
        tg.fertilityBuffer.set(saveData.map.fertility);
        tg.waterQualityBuffer.set(saveData.map.waterQuality);
        tg.mineralDensityBuffer.set(saveData.map.mineralDensity);
        tg.territoryBuffer.set(saveData.map.territory);
        tg.altitudeBuffer.set(saveData.map.altitude);

        // 2. 엔티티 데이터 복구
        const entityCount = saveData.entities.data.length;
        const maxIdInSave = saveData.entities.nextId;
        
        // 🚀 [Critical Fix] 로드할 데이터 양에 맞춰 버퍼 용량 사전 확보 (Crash 방지)
        if (em._ensureCapacity) {
            em._ensureCapacity(Math.max(maxIdInSave, entityCount));
        }

        em.entities.clear();
        em.animalIds.clear();
        em.humanIds.clear();
        em.resourceIds.clear();
        em.buildingIds.clear();
        em.nextId = saveData.entities.nextId;
        em.freeIds = saveData.entities.freeIds || [];

        // 🏗️ SpatialHash 초기화
        const sh = engine.spatialHash || engine.systemManager?.spatialHash;
        if (sh) sh.clear();

        em.statsBuffer.set(saveData.entities.buffers.stats);
        em.statsFloatBuffer.set(saveData.entities.buffers.statsFloat);
        em.stateBuffer.set(saveData.entities.buffers.state);
        em.jobBuffer.set(saveData.entities.buffers.job);
        em.renderBuffer.set(saveData.entities.buffers.render);
        em.aliveBuffer.set(saveData.entities.buffers.alive);
        em.tagBuffer.set(saveData.entities.buffers.tag);
        em.transformBuffer.set(saveData.entities.buffers.transform);

        const protoMap = {
            'DroppedItem': DroppedItem.prototype,
            'JobController': JobController.prototype,
            'AIState': State.prototype,
            'Visual': Visual.prototype,
            'Health': Health.prototype,
            'Transform': Transform.prototype,
            'Velocity': Velocity.prototype,
            'BaseStats': BaseStats.prototype,
            'Inventory': Inventory.prototype,
            'Storage': Storage.prototype
        };

        for (const entData of saveData.entities.data) {
            const entity = {
                id: entData.id,
                components: new Map()
            };

            for (const compData of entData.components) {
                let data = compData.data;
                if (protoMap[compData.name]) {
                    Object.setPrototypeOf(data, protoMap[compData.name]);
                }
                entity.components.set(compData.name, data);
            }

            em.entities.set(entData.id, entity);

            // 🏷️ 타입별 ID 세트 복구
            if (entity.components.has('Animal')) em.animalIds.add(entity.id);
            if (entity.components.has('Human')) em.humanIds.add(entity.id);
            if (entity.components.has('Resource')) em.resourceIds.add(entity.id);
            if (entity.components.has('Building')) em.buildingIds.add(entity.id);

            // 🗺️ SpatialHash 복구
            const t = entity.components.get('Transform');
            if (sh && t) {
                const key = ((Math.floor(t.y / sh.cellSize) + 1000) << 16) | (Math.floor(t.x / sh.cellSize) + 1000);
                
                // 레이어 결정 (0: Dynamic, 1: Static, 2: Obstacle)
                let layer = 0;
                if (entity.components.has('Building') || entity.components.has('Structure') || entity.components.has('VillageCenter')) {
                    layer = 2;
                } else if (entity.components.has('Resource') || entity.components.has('DroppedItem')) {
                    layer = 1;
                }

                sh.insertWithKey(entity.id, key, layer);
                em.cellKeyBuffer[entity.id] = key;
            }
        }

        // 🚀 [Critical] 모든 컴포넌트를 버퍼에 재연결 (DOD 동기화)
        if (em._relinkAllComponents) em._relinkAllComponents();

        // 3. 문명 데이터 복구
        ns.nations.clear();
        ns.nextNationId = saveData.civilization.nextNationId;
        for (const nData of saveData.civilization.nations) {
            const nation = { ...nData };
            nation.villages = new Set(nData.villages);
            nation.atWarWith = new Set(nData.atWarWith);
            nation.allies = new Set(nData.allies);
            nation.hostiles = new Set(nData.hostiles);
            ns.nations.set(nData.id, nation);
        }

        vs.villages.clear();
        vs.nextVillageId = saveData.civilization.nextVillageId;
        for (const vData of saveData.civilization.villages) {
            const village = { ...vData };
            village.members = new Set(vData.members);
            village.buildings = new Set(vData.buildings);
            village.storageIds = new Set(vData.storageIds);
            village.territory = new Set(vData.territory);
            vs.villages.set(vData.id, village);
        }

        zm.zones.clear();
        zm.nextZoneId = saveData.civilization.nextZoneId;
        for (const zData of saveData.civilization.zones) {
            const zone = { ...zData };
            zone.territory = new Set(zData.territory);
            zone.assignedWorkers = new Set(zData.assignedWorkers);
            zm.zones.set(zData.id, zone);
        }

        // 4. 시간 데이터 복구
        time.totalDays = saveData.time.totalDays;
        time.hours = saveData.time.hours;
        time.minutes = saveData.time.minutes;
        time.timeScale = saveData.time.timeScale;

        GlobalLogger.success('✨ Game state restored successfully.');
        if (engine.chunkManager) engine.chunkManager.markAllDirty();
        if (engine.eventBus) engine.eventBus.emit('GAME_LOADED');
    }

    _serializeComponent(comp) {
        const serialized = {};
        for (const key in comp) {
            if (typeof comp[key] === 'function') continue;
            if (key === 'entity' || key === 'engine' || key === 'systemManager') continue;
            
            const val = comp[key];
            if (val === null || val === undefined) {
                serialized[key] = val;
            } else if (val instanceof Set) {
                serialized[key] = Array.from(val);
            } else if (val instanceof Map) {
                serialized[key] = Array.from(val.entries());
            } else if (Array.isArray(val) || (typeof val !== 'object')) {
                serialized[key] = val;
            } else if (val.constructor === Object) {
                // 일반 객체인 경우에만 재귀적으로 또는 직접 저장
                serialized[key] = val; 
            }
            // 그 외의 클래스 인스턴스 등은 무시 (순환 참조 위험)
        }
        return serialized;
    }

    downloadSaveFile() {
        const data = this.serialize();
        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `worldbox_save_${dateStr}.json`;
        a.click();

        URL.revokeObjectURL(url);
        GlobalLogger.info('💾 Save file exported.');
    }

    async uploadSaveFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    await this.deserialize(data);
                    resolve();
                } catch (err) {
                    GlobalLogger.error('🚫 Failed to load save file: ' + err.message);
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}
