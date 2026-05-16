import TerrainGen, { BIOME_NAMES_TO_IDS } from '../world/TerrainGen.js';
import Camera from './Camera.js';
import EntityRenderer from '../systems/render/EntityRenderer.js';
import EntityManager from './EntityManager.js';
import EventBus from './EventBus.js';
import FactoryProvider from '../factories/core/FactoryProvider.js';
import ChunkManager from '../world/ChunkManager.js';
import StatsMonitor from './StatsMonitor.js';
import speciesConfig from '../config/species.json'; // 🚀 LOAD SPECIES 
import Pathfinder from '../utils/Pathfinder.js';
import resourceConfig from '../config/resource_balance.json'; // 🚀 LOAD RESOURCES
import buildingsConfig from '../config/buildings.json';
import techTreeConfig from '../config/tech_tree.json';
import RenderCoordinator from '../systems/render/RenderCoordinator.js';
import SystemManager from './SystemManager.js';
import TimeSystem from '../systems/core/TimeSystem.js';
import ToolManager from './ToolManager.js';
import { JobTypes } from '../config/JobTypes.js';
import { GlobalLogger } from '../utils/Logger.js';
import SaveLoadSystem from '../systems/lifecycle/SaveLoadSystem.js';



export default class Engine {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = options; // 🗺️ Store user map settings
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
        // 🌍 [Scale Expansion] 사용자 설정 맵 크기 적용 (기본값 2400x2400)
        this.mapWidth = options.width || 2400;
        this.mapHeight = options.height || 2400;

        this.camera = new Camera(this.width, this.height, this.mapWidth, this.mapHeight);

        // 🚀 [Culling Optimization] 청크 사이즈를 512로 변경 (과도한 청크 생성으로 인한 캔버스 고갈 방지)
        this.chunkManager = new ChunkManager(this, 512);

        // 🚀 FULL SCREEN INIT: Auto-scale to fill the viewport
        const fitZoom = Math.max(this.width / this.mapWidth, this.height / this.mapHeight);
        this.camera.zoom = Math.max(1.0, fitZoom);
        this.camera.clamp();

        this.entityManager = new EntityManager();
        this.terrainGen = new TerrainGen(this);
        this.eventBus = new EventBus(); // 📡 Global Event Network 생성
        this.renderer = new EntityRenderer(this);

        this.factoryProvider = FactoryProvider;
        this.factoryProvider.init(this);
        // 🚀 주입: 팩토리들이 설정을 참조할 수 있도록 엔진 참조 확인

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
        this.viewFlags = { wind: false, fertility: false, fertilityValue: false, xray: false, water: false, mineral: false, debugAI: false, debugSelectedAI: false, showNames: false, village: false, nation: false, influence: false, zone: false };

        this.gameSpeed = 1.0; // 🚀 시뮬레이션 배속 초기화

        this.saveLoadSystem = new SaveLoadSystem(this); // 💾 Save/Load Logic Init
        this.isStressTestMode = false; // 🌡️ Stress Test Mode Flag

        // 🌉 Global -> EventBus Bridge (AnimalRenders -> ParticleSystem)
        this._onWorldSpawnDust = (e) => {
            this.eventBus.emitDeferred('SPAWN_DUST', e.detail);
        };
        window.addEventListener('WORLD_SHAKE', this._onWorldSpawnDust);

        this.simParams = { spreadSpeed: 1.0, spreadAmount: 5000 };
        this.frameCount = 0; // 🚀 Frame Counter Init

        // 🌡️ [사용자 피드백 반영] 시뮬레이션 파라미터 실시간 업데이트 핸들러
        this.eventBus.on('UPDATE_SIM_PARAMS', (params) => {
            this.simParams = { ...this.simParams, ...params };
            // ⚙️ 워커로 파라미터 동기화
            if (this.worker) {
                this.worker.postMessage({ type: 'UPDATE_PARAMS', payload: params });
            }
        });

        // ⏳ [배속 조절] UI 등에서 발생하는 배속 변경 처리
        this.eventBus.on('SET_GAME_SPEED', (speed) => {
            this.timeSystem.setSpeed(speed);
            if (this.worker) {
                this.worker.postMessage({ type: 'UPDATE_PARAMS', payload: { gameSpeed: speed } });
            }
            GlobalLogger.info(`⏳ Game Speed: ${speed}x`);
        });

        // 🎨 [사용자 피드백 반영] 전체 배경 칠하기(Fill) 핸들러
        this.eventBus.on('APPLY_FILL_TOOL', (payload) => {
            if (this.worker) {
                this.worker.postMessage({ type: 'DISPATCH_COMMAND', payload: { action: 'CHANGE_BIOME_ALL', ...payload } });
                return;
            }
            
            const biomeId = payload.biome;
            const buffer = this.terrainGen.biomeBuffer;

            for (let i = 0; i < buffer.length; i++) {
                if (this.terrainGen.isLand(i)) {
                    this.terrainGen.safeAtomicsStore(buffer, i, biomeId);
                    this.terrainGen.syncPackedPixel(i);
                }
            }
            this.eventBus.emitDeferred('CACHE_PIXEL_UPDATE', { all: true, reason: 'fill_biome' });
        });




        this.onEntitySelect = null;
        this.selectedId = null;
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
            GlobalLogger.info(`💀 God Power: Removing entity ${id}`);
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

    async init() {
        this.isGenerating = true;

        // 📊 통계 및 물 데이터 수집용 객체
        const stats = { totalFertility: 0, potentialFertility: 0 };

        // 🚀 [Expert Optimization] Water Pixel 버퍼 초기화 (2400x2400 대응)
        if (!this.waterPixels) this.waterPixels = new Uint32Array(this.mapWidth * this.mapHeight);
        this.waterCount = 0;

        // 🏗️ [Structural Fix] 워커 초기화 전에 버퍼를 먼저 생성해야 합니다.
        this.terrainGen.createBuffers(this.mapWidth, this.mapHeight);

        // ⚙️ [Simulation Worker] 백그라운드 워커 사전 초기화
        this.initSimulationWorker();

        // 🚀 [Expert Design] 점진적 지형 생성 시작 (통계 및 수역 데이터 수집 병행)
        // 워커가 있으면 워커로 오프로드됩니다.
        await this.terrainGen.generateProgressive(this.mapWidth, this.mapHeight, this, (progress) => {
            this.preRenderTerrain(false); // 색상 재계산 생략
            if (this.onGenerationProgress) this.onGenerationProgress(progress);
        }, stats, this.waterPixels);

        // 결과 적용
        this.monitor.setInitialFertility(stats.totalFertility, stats.potentialFertility);

        this.refreshWaterPixels();
        this.preRenderTerrain();

        this.isGenerating = false;
        if (this.chunkManager) this.chunkManager.initialLoadComplete = true; // 🚀 초기 렌더링 가속 종료
        console.log("🌍 World Initialization Complete. Ready for life.");


        // 📡 시뮬레이션 준비 완료 알림
        this.eventBus.emit('WORLD_READY');

        // 🗺️ [HPA* Step 21/22] 계층적 길찾기 그래프 구축
        import('../utils/Pathfinder.js').then(module => {
            const Pathfinder = module.default;
            Pathfinder.initHierarchy(this);
            this.eventBus.emit('HPA_GRAPH_READY');
        });

        // 🏗️ PoC: 테스트용 글로벌 구역 생성
        setTimeout(() => {
            const zm = this.systemManager?.zoneManager;
            if (zm && zm.zones.size === 0) {
                zm.createZone(100, 100, 150, 150, 'residential');
                zm.createZone(300, 100, 200, 150, 'lumber');
                // Test zones initialized
            }
        }, 1000);
    }

    /** ⚙️ [Expert Design] 시뮬레이션 워커 초기화 및 공유 데이터 동기화 */
    initSimulationWorker() {
        try {
            // Vite는 URL을 통한 워커 생성을 지원함
            this.worker = new Worker(
                new URL('../workers/simulationWorker.js', import.meta.url),
                { type: 'module' }
            );

            // TerrainGen에서 공유 버퍼 목록을 가져와 워커로 전송
            const sharedData = this.terrainGen.getSharedBuffers();
            this.worker.postMessage({
                type: 'INIT',
                payload: { ...sharedData, simParams: this.simParams }
            });

            this.worker.onmessage = (e) => {
                const { type, payload } = e.data;
                if (type === 'PIXEL_UPDATE') {
                    this.eventBus.emitDeferred('CACHE_PIXEL_UPDATE', payload);
                } else if (type === 'PIXEL_UPDATE_BATCH') {
                    // 🚀 [Task 94] Batch 처리된 픽셀 업데이트 수신
                    for (let i = 0; i < payload.length; i++) {
                        this.eventBus.emitDeferred('CACHE_PIXEL_UPDATE', payload[i]);
                    }
                } else if (type === 'HPA_GRAPH_REBUILT') {
                    // 🗺️ [Expert AI] 워커에서 재계산된 HPA* 그래프 반영
                    import('../utils/Pathfinder.js').then(module => {
                        module.default.applyRebuiltGraph(payload);
                    });
                }
            };

            GlobalLogger.info("⚙️ [Engine] Simulation Worker initialized with SharedArrayBuffer.");
        } catch (error) {
            GlobalLogger.error("❌ [Engine] Failed to initialize Simulation Worker:", error);
        }
    }


    updateFertilityStat(oldVal, newVal) { this.monitor.updateFertilityStat(oldVal, newVal); }
    updatePotentialStat(oldMax, newMax) { this.monitor.updatePotentialStat(oldMax, newMax); }

    async preRenderTerrain(recalculateColors = true) {
        if (this.chunkManager) {
            // 🚀 [Optimization] 생성 중에는 색상 재계산을 생략하여 메인 스레드 점유 방지
            const shouldRecalculate = recalculateColors && !this.isGenerating;
            await this.chunkManager.markAllDirty(shouldRecalculate);
        }
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

        // [Optimization] Loop removed. Incremental sync enabled.
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


    /** 🧹 [Expert UI] 모든 뷰 필터 플래그 초기화 */
    clearAllViewFlags() {
        const flags = this.viewFlags;
        flags.wind = false;
        flags.fertility = false;
        flags.fertilityValue = false;
        flags.xray = false;
        flags.water = false;
        flags.mineral = false;
        flags.debugAI = false;
        flags.debugSelectedAI = false;
        flags.showNames = false;
        flags.village = false;
        flags.nation = false;
        flags.zone = false;
        flags.VILLAGETILE = false;
        flags.NATIONTILE = false;
        flags.influence = false;
        this.preRenderTerrain();
    }

    setActiveTool(tool) {
        // [Expert Fix] 새로운 도구가 선택되면 기존 도구의 후처리 수행
        if (this.activeTool && this.activeTool.onMouseUp) {
            const command = this.activeTool.onMouseUp();
            if (command) this.dispatchCommand(command);
        }

        // [Expert Choice] 상호작용 도구(브러시, 스폰 등)가 선택되면 모든 뷰 필터 초기화
        // 단, '손(Move)' 도구이거나 뷰 도구 자체일 때는 초기화하지 않음 (개별 toggleView에서 처리)
        if (tool && tool.id !== 'move_hand' && !tool.id.startsWith('view_')) {
            this.clearAllViewFlags();
        }

        this.activeTool = tool;
        if (this.toolManager && tool) {
            this.toolManager.setTool(tool.id);
            GlobalLogger.info(`🛠️ Tool Switched: ${tool.name}`);
        }
        this.isPainting = false;
        if (this.camera) this.camera.isDragging = false;
    }

    toggleView(id) {
        // 🚀 [Expert Design] 뷰 필터 키 매핑 (ID -> viewFlags Key)
        const flagMap = {
            'view_wind': 'wind',
            'view_fertility': 'fertility',
            'view_fertility_value': 'fertilityValue',
            'view_water': 'water',
            'view_mineral': 'mineral',
            'view_xray': 'xray',
            'view_debug_ai': 'debugAI',
            'view_debugAI': 'debugAI',
            'view_debug_selected_ai': 'debugSelectedAI',
            'view_showNames': 'showNames',
            'view_village': 'village',
            'view_nation': 'nation',
            'view_zone': 'zone'
        };

        const targetKey = flagMap[id];
        if (!targetKey) return;

        const currentState = this.viewFlags[targetKey];

        // 🚀 [Expert Design] 모든 뷰 필터 상호 배제 (Mutual Exclusivity)
        this.clearAllViewFlags();

        // 선택한 필터가 꺼져있었다면 켭니다 (Toggle 동작)
        if (!currentState) {
            this.viewFlags[targetKey] = true;

            // 특수 처리 레이어 (영토, 영향력 등)
            if (targetKey === 'village') this.viewFlags.VILLAGETILE = true;
            if (targetKey === 'nation') {
                this.viewFlags.NATIONTILE = true;
                this.viewFlags.influence = true;
            }

            // 🎯 뷰 필터가 켜지면 기본 도구를 'Move'로 변경하여 충돌 방지
            this.setActiveTool(this.toolManager.getTool('move_hand'));
            GlobalLogger.info(`👁️ View Filter Active: ${targetKey}`);
        } else {
            GlobalLogger.info(`👁️ View Filter Disabled: ${targetKey}`);
        }
        
        this.preRenderTerrain();
    }


    // 🚀 도구 및 이벤트 등에서 넘어온 명령(Command)을 일괄적으로 처리하는 중앙 분배기
    dispatchCommand(command) {
        if (!command) return;
        switch (command.type) {
            case 'BATCH_COMMANDS':
                if (command.payload?.actions) {
                    command.payload.actions.forEach(cmd => this.dispatchCommand(cmd));
                }
                break;
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
                this.eventBus.emitDeferred('SPAWN_PARTICLES', command.payload);
                break;
            case 'SPAWN_ENTITY':
                const methodToType = {
                    spawnSheep: 'sheep', spawnHuman: 'human', spawnCow: 'cow', spawnWolf: 'wolf',
                    spawnHyena: 'hyena', spawnWildDog: 'wild_dog', spawnTiger: 'tiger',
                    spawnLion: 'lion', spawnBear: 'bear', spawnFox: 'fox',
                    spawnCrocodile: 'crocodile', spawnDeer: 'deer', spawnRabbit: 'rabbit',
                    spawnHorse: 'horse', spawnElephant: 'elephant', spawnGoat: 'goat'
                };
                const type = methodToType[command.payload.method] || command.payload.type;
                const category = command.payload.category;
                
                if (category && type) {
                    const id = this.factoryProvider.spawn(category, type, command.payload.x, command.payload.y, command.payload.options || {});
                    if (id) {
                        this.eventBus.emit('ENTITY_SPAWNED', { id, type, category, x: command.payload.x, y: command.payload.y });
                    }
                } else if (type) {
                    this.eventBus.emit('SPAWN_ENTITY', { type, x: command.payload.x, y: command.payload.y, isBaby: false });
                }
                break;
            case 'CHANGE_BIOME':
                if (this.worker) {
                    this.worker.postMessage({ type: 'APPLY_TOOL', payload: { ...command.payload, action: 'CHANGE_BIOME' } });
                } else {
                    this.eventBus.emit('APPLY_TOOL_EFFECT', { ...command.payload, action: 'CHANGE_BIOME' });
                }
                break;
            case 'APPLY_GOD_POWER':
                if (this.worker) {
                    this.worker.postMessage({ type: 'APPLY_GOD_POWER', payload: command.payload });
                }
                // 기존 GodPowerSystem에서도 처리가 필요할 수 있으므로 emit도 유지 (엔티티 제거 등)
                this.eventBus.emit('APPLY_GOD_POWER', command.payload);
                break;
            case 'SPAWN_RESOURCE':
                const resType = command.payload.type || command.payload.resourceId;
                const resAmount = command.payload.amount || 1;

                // 🌳 [Data-Driven Fix] 하드코딩된 목록 대신 resource_balance.json의 type을 기반으로 자동 판별
                const config = this.resourceConfig[resType];
                const resCategory = config?.type;

                // food, wood 카테고리는 NatureFactory에서, mineral, fertilizer 등은 ResourceFactory에서 처리
                const isNature = resCategory === 'food' || resCategory === 'wood' || resType.includes('tree');
                const cat = isNature ? 'nature' : 'resource';
                this.factoryProvider.spawn(cat, resType, command.payload.x, command.payload.y, { quality: resAmount / 20 });
                GlobalLogger.success(`Spawned ${resType.toUpperCase()} at (${Math.floor(command.payload.x)}, ${Math.floor(command.payload.y)})`);
                break;
            case 'TOGGLE_VIEW':
                this.toggleView(`view_${command.payload.flagName}`);
                break;
            case 'SET_GAME_SPEED':
                this.gameSpeed = parseFloat(command.payload.speed) || 1.0;
                if (this.timeSystem) this.timeSystem.setSpeed(this.gameSpeed);
                break;
            case 'INSPECT':
                this.eventBus.emit('INSPECT_REQUEST', command.payload.worldPos);
                break;
            case 'APPLY_FILL_TOOL':
                this.eventBus.emit('APPLY_FILL_TOOL', command.payload);
                break;
            case 'PLACE_BLUEPRINT':
                this.factoryProvider.spawn('building', command.payload.type, command.payload.x, command.payload.y, { isBlueprint: true });
                GlobalLogger.info(`Placed blueprint for ${command.payload.type.toUpperCase()} at (${Math.floor(command.payload.x)}, ${Math.floor(command.payload.y)})`);
                break;
            case 'SPAWN_DROPPED_ITEM':
                const itemFactory = this.factoryProvider.getFactory('item');
                if (itemFactory) {
                    itemFactory.spawnDrop(command.payload.x, command.payload.y, command.payload.type, command.payload.amount);
                }
                break;
            case 'APPLY_GOD_POWER':
                this.systemManager.godPower?.applyPower(
                    command.payload.powerType,
                    command.payload.x,
                    command.payload.y,
                    command.payload.radius
                );
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

    loop(time) {
        if (!this.isRunning) return;
        let dt = (time - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; // 스파이크 방지
        this.lastTime = time;

        // 🚀 [Time Control] 배속 적용 (1x, 2x, 3x, 5x)
        const effectiveDt = (this.isStressTestMode ? dt * 5.0 : dt) * (this.gameSpeed || 1.0);

        this.monitor.update(time);
        this.camera.update(effectiveDt); // 🎥 카메라 부드러운 이동 보간 및 쉐이크 업데이트
        this.frameCount++; 

        this.update(effectiveDt);

        // 🌡️ [Stress Test Logic]
        if (this.isStressTestMode && this.frameCount % 60 === 0) {
            this._runStressTestLogic();
        }

        // 🚀 [Expert Optimization] 프레임 끝에서 지연된 이벤트들 일괄 처리
        this.eventBus.flush();

        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    _runStressTestLogic() {
        // 🚀 [Task 100] 최종 마스터 릴리즈 스트레스 테스트 (목표치: 200,000 마리)
        if (this.entityManager.humanIds.size < 200000) {
            const spawner = this.systemManager.spawner;
            if (spawner) {
                // 프레임 드랍을 최소화하면서 빠르게 늘리기 위해 초당 2000마리 스폰
                for (let i = 0; i < 2000; i++) {
                    const x = Math.random() * this.mapWidth;
                    const y = Math.random() * this.mapHeight;
                    spawner.spawnEntity({ type: 'human', x, y });
                }
            }
        }
    }

    /** 💾 [Persistence] 게임 내보내기 */
    exportSave() {
        this.saveLoadSystem.downloadSaveFile();
    }

    /** 📂 [Persistence] 게임 불러오기 */
    async importSave(file) {
        await this.saveLoadSystem.uploadSaveFile(file);
    }

    /** 🌡️ [Stress Test] 모드 토글 */
    toggleStressTest(enabled) {
        this.isStressTestMode = enabled;
        GlobalLogger.warn(`🌡️ Stress Test Mode: ${enabled ? 'ENABLED (x5 Speed)' : 'DISABLED'}`);
        
        if (!enabled) {
            // 🧹 스트레스 테스트 종료 시 쌓인 캐시와 대기열 즉시 정리
            this.renderCoordinator.entityRenderer.spriteCache.clear();
            import('../objects/renders/AnimalRenders.js').then(m => m.AnimalRenders.clearCache());
            Pathfinder.invalidateCache();
            GlobalLogger.info("🧹 [Stress Test] Post-cleanup: Caches cleared.");
        }
    }

    update(dt) {
        if (this.isGenerating || this._nationSyncLock) return;
        const time = performance.now();

        // 각 시스템의 업데이트 순서를 명시적으로 관리하는 매니저로 위임 (폴링/이벤트 기반 이원화)
        this.systemManager.update(dt, time);

        // 🗺️ [HPA* Step 23/27] 계층적 길찾기 그래프 업데이트 및 요청 대기열 처리
        Pathfinder.updateHierarchy(this);
        Pathfinder.processQueue();

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
    /**
     * 🧹 [Memory Management] 엔진 종료 및 자원 일괄 해제
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);

        // 1. 모든 시스템 파괴
        if (this.systemManager) this.systemManager.destroy();

        // 2. 엔티티 및 컴포넌트 강제 해제
        if (this.entityManager) this.entityManager.clearAll();

        // 3. 이벤트 구독 일괄 해제
        if (this.eventBus) this.eventBus.clear();

        // 4. 큰 버퍼 메모리 해제 지원
        this.terrainGen = null;
        this.chunkManager = null;

        GlobalLogger.warn("🛑 [Engine] Destroyed. Memory cleared.");
    }
}
