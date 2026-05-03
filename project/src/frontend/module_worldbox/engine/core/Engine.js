import TerrainGen, { BIOME_NAMES_TO_IDS } from '../world/TerrainGen.js';
import Camera from './Camera.js';
import EntityRenderer from '../systems/render/EntityRenderer.js';
import EntityManager from './EntityManager.js';
import EventBus from './EventBus.js';
import FactoryProvider from '../factories/core/FactoryProvider.js';
import ChunkManager from '../world/ChunkManager.js';
import StatsMonitor from './StatsMonitor.js';
import speciesConfig from '../config/species.json'; // 🚀 LOAD SPECIES 
import resourceConfig from '../config/resource_balance.json'; // 🚀 LOAD RESOURCES
import buildingsConfig from '../config/buildings.json';
import techTreeConfig from '../config/tech_tree.json';
import RenderCoordinator from '../systems/render/RenderCoordinator.js';
import SystemManager from './SystemManager.js';
import TimeSystem from '../systems/core/TimeSystem.js';
import ToolManager from './ToolManager.js';



export default class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.speciesConfig = speciesConfig;
        this.resourceConfig = resourceConfig;
        this.buildingsConfig = buildingsConfig;
        this.techTreeConfig = techTreeConfig;

        // 🚀 SMART RESOLUTION: Fix the 'tiny canvas' issue
        const rect = canvas.getBoundingClientRect();
        this.width = rect.width || window.innerWidth;
        this.height = rect.height || window.innerHeight;

        // Ensure the drawing buffer matches high-DPI screens without shrinking the layout
        canvas.width = this.width;
        canvas.height = this.height;

        // Force the canvas to stretch back to its intended layout size
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        this.ctx = canvas.getContext('2d', { alpha: false });
        // 🖼️ 최적화된 800x800 그리드 체제로 조정 (성능과 스케일의 균형)
        this.mapWidth = 800;
        this.mapHeight = 800;


        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = this.mapWidth;
        this.terrainCanvas.height = this.mapHeight;
        this.terrainCtx = this.terrainCanvas.getContext('2d', { alpha: false });

        // 👁️ RESTORED: Intelligent Camera with Boundary & Mouse-Center Zoom
        this.camera = new Camera(this.width, this.height, this.mapWidth, this.mapHeight);

        // 🚀 FULL SCREEN INIT: Auto-scale to fill the viewport
        const fitZoom = Math.max(this.width / this.mapWidth, this.height / this.mapHeight);
        this.camera.zoom = Math.max(1.0, fitZoom);
        this.camera.clamp();

        this.terrainGen = new TerrainGen();
        this.entityManager = new EntityManager(); // EntityManager는 TerrainGen 생성 후 초기화
        this.eventBus = new EventBus(); // 📡 Global Event Network 생성
        this.renderer = new EntityRenderer(this);

        this.factoryProvider = new FactoryProvider(this); 

        // 단일 책임 원칙(SRP) 준수를 위한 시스템 매니저 도입
        this.systemManager = new SystemManager(this);
        this.inputSystem = this.systemManager.inputSystem;
        this.environment = this.systemManager.environment;
        this.particleSystem = this.systemManager.particleSystem;
        this.wind = this.systemManager.wind;
        this.spawner = this.systemManager.spawner;

        this.isRunning = false;
        this.lastTime = 0;
        this.time = 0;
        this.timeSystem = new TimeSystem(); // ⏳ World Clock Init

        this.isPainting = false;
        this.brushSize = 50; // 🚀 High-res optimized brush size
        this.viewFlags = { wind: false, fertility: false, fertilityValue: false, xray: false, water: false, mineral: false, debugAI: true, showNames: false, village: false, zone: false };

        // 🌉 Global -> EventBus Bridge (AnimalRenders -> ParticleSystem)
        this._onWorldSpawnDust = (e) => {
            this.eventBus.emit('SPAWN_DUST', e.detail);
        };
        window.addEventListener('WORLD_SPAWN_DUST', this._onWorldSpawnDust);

        this.simParams = { spreadSpeed: 1.0, spreadAmount: 5000 };
        this.frameCount = 0; // 🚀 Frame Counter Init

        // 🌡️ [사용자 피드백 반영] 시뮬레이션 파라미터 실시간 업데이트 핸들러
        this.eventBus.on('UPDATE_SIM_PARAMS', (params) => {
            this.simParams = { ...this.simParams, ...params };
        });

        // 🎨 [사용자 피드백 반영] 전체 배경 칠하기(Fill) 핸들러
        this.eventBus.on('APPLY_FILL_TOOL', (payload) => {
            const biomeId = payload.biome;
            const width = this.mapWidth;
            const height = this.mapHeight;
            const buffer = this.terrainGen.biomeBuffer;
            
            for (let i = 0; i < buffer.length; i++) {
                // 바다가 아닌 육지(DIRT, GRASS 등)만 채우기 대상으로 설정
                if (this.terrainGen.isLand(buffer[i])) {
                    buffer[i] = biomeId;
                }
            }
            // 전체 렌더링 갱신 통보 (메모리 효율을 위해 전체 업데이트 플래그 사용 가능)
            this.eventBus.emit('CACHE_PIXEL_UPDATE', { all: true, reason: 'fill_biome' });
        });




        this.onEntitySelect = null;
        this.selectedId = null;
        this.chunkManager = new ChunkManager(this, 50);
        this.isFollowing = false;

        this.monitor = new StatsMonitor(this);
        this.toolManager = new ToolManager(this); // 🛠️ 전략 패턴 기반 툴 매니저 도입

        this.init();
        this.renderCoordinator = new RenderCoordinator(this.entityManager, this.eventBus, this); // 🖼️ Render Orchestrator Init

        // 📡 Subscribe to UI Selection Event for Rendering
        this.eventBus.on('ENTITY_SELECTED', (id) => {
            this.selectedId = id;
        });

        // 📡 Subscribe to Spawner/Environment pixel updates
        this.eventBus.on('CACHE_PIXEL_UPDATE', (data) => {
            // 전체 갱신 요청 (예: 배경 칠하기)
            if (data.all) {
                this.preRenderTerrain();
                return;
            }
            // 비옥도 변화나 바이옴 변화 시 항상 픽셀 갱신
            if (data.reason === 'biome_change' || data.reason === 'biome_spread' || data.reason === 'fertility_change' || this.viewFlags.fertility) {
                this.updateCachePixel(data.x, data.y);
            }
        });
        this.eventBus.on('REFRESH_FERTILITY_VIEW', () => {
            if (this.viewFlags.fertility) {
                this.chunkManager.markAllDirty();
            }
        });


        this.eventBus.on('REFRESH_WATER_PIXELS', () => {
            this.refreshWaterPixels();
        });

        // 💀 [God Power] 엔티티 강제 제거 요청 처리
        this.eventBus.on('ENTITY_KILL_REQUEST', (id) => {
            console.log(`💀 God Power: Removing entity ${id}`);
            this.entityManager.removeEntity(id);
            if (this.selectedId === id) {
                this.selectedId = null;
                this.eventBus.emit('ENTITY_SELECTED', null);
            }
        });

        // 📡 Subscribe to Stats updates
        // Engine은 StatsMonitor를 통해 통계를 관리하므로, EventBus를 통해 업데이트를 받습니다.
        this.eventBus.on('STATS_UPDATED', (payload) => {
            if (payload.type === 'fertility') {
                this.updateFertilityStat(payload.oldVal, payload.newVal);
            } else if (payload.type === 'potential_fertility') {
                this.updatePotentialStat(payload.oldVal, payload.newVal);
            }
        });
    }

    init() {
        this.terrainGen.generate(this.mapWidth, this.mapHeight); // Call the new generate method
        let total = 0;
        let potential = 0;
        const fb = this.terrainGen.fertilityBuffer;
        const bb = this.terrainGen.biomeBuffer;
        for (let i = 0; i < fb.length; i++) {
            total += fb[i];
            potential += this.environment.getMaxFertility(bb[i]);
        }


        this.monitor.setInitialFertility(total, potential);
        this.refreshWaterPixels();
        this.preRenderTerrain();

        // 🏗️ PoC: 테스트용 글로벌 구역 생성 (마을이 없을 때도 보이도록)
        setTimeout(() => {
            const zm = this.systemManager?.zoneManager;
            if (zm && zm.zones.size === 0) {
                zm.createZone(100, 100, 150, 150, 'residential');
                zm.createZone(300, 100, 200, 150, 'lumber');
                console.log("🗺️ PoC Test Zones created at init");
            }
        }, 1000);
    }


    updateFertilityStat(oldVal, newVal) { this.monitor.updateFertilityStat(oldVal, newVal); }
    updatePotentialStat(oldMax, newMax) { this.monitor.updatePotentialStat(oldMax, newMax); }

    preRenderTerrain() {
        this.chunkManager.markAllDirty();
        this.chunkManager.render(this.terrainCtx);
    }

    renderDirtyTiles() {
        this.chunkManager.render(this.terrainCtx);
    }

    updateCachePixel(x, y) {
        this.chunkManager.markDirty(x, y);
    }

    refreshWaterPixels() {
        // 🚀 [Memory Optimization] 일반 배열 대신 TypedArray 사용 (메모리 파편화 방지)
        if (!this.waterPixels || this.waterPixels.length !== this.mapWidth * this.mapHeight) {
            this.waterPixels = new Uint32Array(this.mapWidth * this.mapHeight);
        }
        this.waterCount = 0;
        
        const buffer = this.terrainGen.biomeBuffer;
        const OCEAN_ID = BIOME_NAMES_TO_IDS.get('OCEAN');
        const DEEP_ID = BIOME_NAMES_TO_IDS.get('DEEP_OCEAN');
        const LAKE_ID = BIOME_NAMES_TO_IDS.get('LAKE');
        const RIVER_ID = BIOME_NAMES_TO_IDS.get('RIVER');

        for (let i = 0; i < buffer.length; i++) {
            const b = buffer[i];
            if (b === OCEAN_ID || b === DEEP_ID || b === LAKE_ID || b === RIVER_ID) {
                this.waterPixels[this.waterCount++] = i;
            }
        }
    }

    handleResize(w, h) {
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;

        if (this.camera) {
            this.camera.width = w;
            this.camera.height = h;
            this.camera.clamp();
        }

        if (this.renderCoordinator) {
            this.renderCoordinator.resize(w, h);
        }
        this.preRenderTerrain();
        this.chunkManager.dirtyChunks.clear();
    }


    setActiveTool(tool) {
        if (this.activeTool && this.activeTool.onMouseUp) {
            const command = this.activeTool.onMouseUp();
            this.dispatchCommand(command);
        }
        this.activeTool = tool;
        if (this.toolManager && tool) {
            this.toolManager.setTool(tool.id);
        }
        this.isPainting = false;
        if (this.camera) this.camera.isDragging = false;
    }

    toggleView(id) {
        if (id === 'view_wind') this.viewFlags.wind = !this.viewFlags.wind;
        if (id === 'view_fertility') {
            this.viewFlags.fertility = !this.viewFlags.fertility;
            this.viewFlags.water = false;
            this.viewFlags.mineral = false;
            this.preRenderTerrain();
            this.chunkManager.dirtyChunks.clear();
        }
        if (id === 'view_fertility_value') {
            this.viewFlags.fertilityValue = !this.viewFlags.fertilityValue;
        }
        if (id === 'view_water') {

            this.viewFlags.water = !this.viewFlags.water;
            this.viewFlags.fertility = false;
            this.viewFlags.mineral = false;
            this.preRenderTerrain();
            this.chunkManager.dirtyChunks.clear();
        }
        if (id === 'view_mineral') {
            this.viewFlags.mineral = !this.viewFlags.mineral;
            this.viewFlags.fertility = false;
            this.viewFlags.water = false;
            this.preRenderTerrain();
            this.chunkManager.dirtyChunks.clear();
        }
        if (id === 'view_xray') this.viewFlags.xray = !this.viewFlags.xray;
        if (id === 'view_debug_ai') this.viewFlags.debugAI = !this.viewFlags.debugAI;
        if (id === 'view_showNames') this.viewFlags.showNames = !this.viewFlags.showNames;
        if (id === 'view_village') this.viewFlags.village = !this.viewFlags.village;
        if (id === 'view_zone') this.viewFlags.zone = !this.viewFlags.zone;
    }


    // 🚀 도구 및 이벤트 등에서 넘어온 명령(Command)을 일괄적으로 처리하는 중앙 분배기
    dispatchCommand(command) {
        if (!command) return;
        switch (command.type) {
            case 'CAMERA_DOWN':
                this.camera.handleMouseDown(command.event);
                break;
            case 'CAMERA_MOVE':
                this.camera.handleMouseMove(command.event);
                break;
            case 'CAMERA_UP':
                this.camera.handleMouseUp();
                break;
            case 'SPAWN_PARTICLES':
                this.eventBus.emit('SPAWN_PARTICLES', command.payload);
                break;
            case 'SPAWN_ENTITY':
                const methodToType = { 
                    spawnSheep: 'sheep', 
                    spawnHuman: 'human', 
                    spawnCow: 'cow', 
                    spawnWolf: 'wolf', 
                    spawnHyena: 'hyena', 
                    spawnWildDog: 'wild_dog',
                    spawnTiger: 'tiger',
                    spawnLion: 'lion',
                    spawnBear: 'bear',
                    spawnFox: 'fox',
                    spawnCrocodile: 'crocodile',
                    spawnDeer: 'deer',
                    spawnRabbit: 'rabbit',
                    spawnHorse: 'horse',
                    spawnElephant: 'elephant',
                    spawnGoat: 'goat'
                };
                const type = methodToType[command.payload.method];
                if (type) this.eventBus.emit('SPAWN_ENTITY', { type, x: command.payload.x, y: command.payload.y, isBaby: false });
                break;
            case 'CHANGE_BIOME':
                this.eventBus.emit('APPLY_TOOL_EFFECT', { ...command.payload, action: 'CHANGE_BIOME' });
                break;
            case 'SPAWN_RESOURCE':
                const resType = command.payload.type || command.payload.resourceId;
                const resAmount = command.payload.amount || 1;
                
                // 🌳 Nature와 Resource 카테고리 자동 판별
                const isNature = resType.includes('tree') || resType.includes('grass') || 
                                 resType.includes('flower') || ['berry', 'shrub', 'mushroom', 'cactus', 'kelp', 'seaweed', 'lotus', 'reed', 'snow_flower', 'medicinal_herb'].includes(resType);
                
                const cat = isNature ? 'nature' : 'resource';
                this.factoryProvider.spawn(cat, resType, command.payload.x, command.payload.y, { quality: resAmount / 20 });
                break;
            case 'TOGGLE_VIEW':
                this.toggleView(`view_${command.payload.flagName}`);
                break;
            case 'INSPECT':
                this.eventBus.emit('INSPECT_REQUEST', command.payload.worldPos);
                break;
            case 'APPLY_FILL_TOOL':
                this.eventBus.emit('APPLY_FILL_TOOL', command.payload);
                break;
            case 'PLACE_BLUEPRINT':
                this.factoryProvider.spawn('building', command.payload.type, command.payload.x, command.payload.y, { isBlueprint: true });
                break;
        }
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    stop() { this.isRunning = false; }

    destroy() {
        this.stop();
        window.removeEventListener('WORLD_SPAWN_DUST', this._onWorldSpawnDust);

        if (this.systemManager && this.systemManager.destroy) {
            this.systemManager.destroy();
        }

        if (this.chunkManager && this.chunkManager.destroy) {
            this.chunkManager.destroy();
        }
    }

    loop(time) {
        if (!this.isRunning) return;
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.monitor.update(time);

        this.frameCount++; // 🚀 Increment frame counter
        this.update(dt);
        if (this.chunkManager.dirtyChunks.size > 0) this.renderDirtyTiles();
        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        const time = performance.now();

        // 각 시스템의 업데이트 순서를 명시적으로 관리하는 매니저로 위임 (폴링/이벤트 기반 이원화)
        this.systemManager.update(dt, time);
        
        // ⏳ 시간 시스템 업데이트 (ms 단위 deltaTime 전달, 엔진 인스턴스 공유)
        this.timeSystem.update(dt * 1000, this);

        if (this.selectedId) {
            const e = this.entityManager.entities.get(this.selectedId);
            if (e) {
                // 🎥 카메라 추적 (기존 로직)
                if (this.onEntitySelect && this.isFollowing) {
                    const t = e.components.get('Transform');
                    if (t) {
                        this.camera.x = t.x - (this.width / this.camera.zoom) / 2;
                        this.camera.y = t.y - (this.height / this.camera.zoom) / 2;
                        this.camera.clamp();
                    }
                }
            } else {
                // 개체가 삭제되었다면(죽음 등) 선택 해제
                this.selectedId = null;
                this.eventBus.emit('ENTITY_SELECTED', null);
            }
        }
    }

    render() {
        // 🖼️ [Step 5: Offscreen Canvas] Delegate all rendering to the coordinator
        this.renderCoordinator.render(this.ctx);
    }



    // renderFertilityTooltip is now handled by RenderCoordinator.js
}
