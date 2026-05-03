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

                // 1. 활성화된 도구 확인
                const activeTool = this.engine.toolManager?.activeTool;

                // 2. 문 상호작용 체크 (활성화된 건설/소환 도구가 없을 때만)
                const isActionTool = activeTool && !['inspect_entity', 'grab_entity', 'move_hand'].includes(activeTool.id);
                if (!isActionTool) {
                    const nearbyBuildings = this.engine.spatialHash.query(world.x, world.y, 20);
                    for (const id of nearbyBuildings) {
                        const ent = this.entityManager.entities.get(id);
                        if (ent && ent.components.has('Door')) {
                            const door = ent.components.get('Door');
                            door.toggle();
                            this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: world.x, y: world.y, reason: 'door_toggle' });
                            return;
                        }
                    }
                }

                // 🚀 ToolManager를 통한 도구 실행 위임 (이곳에서 INSPECT 명령 등이 나감)
                if (this.engine.toolManager) {
                    const cmd = this.engine.toolManager.handleMouseDown(world, e);
                    if (cmd) this.engine.dispatchCommand(cmd);
                }

                // 🛠️ [Grab logic] 오직 grab_entity 도구가 선택되었을 때만 그랩 발동
                if (activeTool?.id === 'grab_entity') {
                    const nearest = this.findNearestEntity(world, 25); // 판정 범위를 약간 넉넉하게 조정
                    if (nearest) {
                        this.draggedEntityId = nearest;
                        const ent = this.entityManager.entities.get(nearest);
                        const state = ent?.components.get('AIState');
                        if (state) state.pushMode('grabbed');
                        console.log(`🫳 Grabbed Entity: ${nearest}`);
                        return;
                    }
                }

                // 🖐️ move_hand 도구가 선택되었거나 도구가 없을 때 카메라 조작
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
                    // 🛡️ [Safety Fix] spatialHash 존재 여부 및 update 메서드 체크
                    const sh = this.engine.spatialHash;
                    if (sh && typeof sh.update === 'function') {
                        sh.update(this.draggedEntityId, world.x, world.y);
                    }
                }
                return;
            }

            // 🚀 ToolManager를 통한 도구 실행 위임
            if (this.engine.toolManager) {
                const cmd = this.engine.toolManager.handleMouseMove(world, e);
                if (cmd) this.engine.dispatchCommand(cmd);
            }

            const activeTool = this.engine.toolManager?.activeTool;
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
            if (this.engine.toolManager) {
                const cmd = this.engine.toolManager.handleMouseUp(e);
                if (cmd) this.engine.dispatchCommand(cmd);
            }

            const activeTool = this.engine.toolManager?.activeTool;
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