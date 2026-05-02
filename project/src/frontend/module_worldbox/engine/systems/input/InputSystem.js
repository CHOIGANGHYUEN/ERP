import System from "../../core/System";

export default class InputSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.canvas = engine.canvas;
        this.camera = engine.camera;

        this.setupInput();
    }

    setupInput() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                const rect = this.canvas.getBoundingClientRect();
                const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);
                
                // 1. 드래그 앤 드롭 시작 체크
                const activeTool = this.engine.toolManager.activeTool;
                if (!activeTool || 
                    activeTool.id === 'inspect_entity' || 
                    activeTool.id === 'grab_entity') {
                    const nearby = this.engine.spatialHash.query(world.x, world.y, 15);
                    for (const id of nearby) {
                        const ent = this.entityManager.entities.get(id);
                        if (ent && (ent.components.has('Animal') || ent.components.has('Human'))) {
                            this.draggedEntityId = id;
                            const state = ent.components.get('AIState');
                            if (state) state.pushMode('grabbed');
                            return;
                        }
                    }
                }

                // 2. 문 상호작용 체크 (활성화된 건설/소환 도구가 없을 때만)
                const isToolActive = activeTool && activeTool.id !== 'inspect_entity' && activeTool.id !== 'grab_entity';
                if (!isToolActive) {
                    const nearbyBuildings = this.engine.spatialHash.query(world.x, world.y, 20);
                    for (const id of nearbyBuildings) {
                        const ent = this.entityManager.entities.get(id);
                        if (ent && ent.components.has('Door')) {
                            const door = ent.components.get('Door');
                            door.toggle();
                            // 시각적 갱신을 위해 픽셀 업데이트 통보
                            this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: world.x, y: world.y, reason: 'door_toggle' });
                            return;
                        }
                    }
                }

                // 🚀 ToolManager를 통한 도구 실행 위임
                this.engine.toolManager.handleMouseDown(world, e);

                if (!activeTool || activeTool.id === 'move_hand') {
                    this.camera.handleMouseDown(e);
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const world = this.camera.screenToWorld(e.clientX, e.clientY, rect);
            
            // 📍 Track mouse position for engine access (e.g. tooltips)
            this.mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            this.mouseWorld = world;

            // 3. 드래그 중인 개체 위치 업데이트
            if (this.draggedEntityId) {
                const ent = this.entityManager.entities.get(this.draggedEntityId);
                const transform = ent?.components.get('Transform');
                if (transform) {
                    transform.x = world.x;
                    transform.y = world.y;
                    // 공간 해시 실시간 업데이트 (다른 시스템에서 인식하도록)
                    this.engine.spatialHash.update(this.draggedEntityId, world.x, world.y);
                }
                return;
            }

            // 🚀 ToolManager를 통한 도구 실행 위임
            this.engine.toolManager.handleMouseMove(world, e);

            const activeTool = this.engine.toolManager.activeTool;
            if (!activeTool || activeTool.id === 'move_hand') {
                this.camera.handleMouseMove(e);
            }
        });


        window.addEventListener('mouseup', (e) => {
            // 4. 드래그 종료
            if (this.draggedEntityId) {
                const ent = this.entityManager.entities.get(this.draggedEntityId);
                const state = ent?.components.get('AIState');
                if (state && state.mode === 'grabbed') {
                    state.popMode();
                }
                this.draggedEntityId = null;
                return;
            }

            // 🚀 ToolManager를 통한 도구 실행 위임
            this.engine.toolManager.handleMouseUp(e);
            
            const activeTool = this.engine.toolManager.activeTool;
            if (!activeTool || activeTool.id === 'move_hand') {
                this.camera.handleMouseUp();
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.handleWheel(e);
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'x') {
                this.engine.toggleView('view_xray');
            }
        });
    }

    update(dt, time) {
        // InputSystem은 DOM 이벤트 드리븐으로 동작하므로 매 프레임 업데이트는 비워둡니다.
    }
}