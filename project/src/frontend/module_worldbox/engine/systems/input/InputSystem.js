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
                if (this.engine.activeTool && this.engine.activeTool.onMouseDown) {
                    const command = this.engine.activeTool.onMouseDown(world, e);
                    this.engine.dispatchCommand(command);
                } else {
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

            if (this.engine.activeTool && this.engine.activeTool.onMouseMove) {
                const command = this.engine.activeTool.onMouseMove(world, e);
                this.engine.dispatchCommand(command);
            } else {
                this.camera.handleMouseMove(e);
            }
        });


        window.addEventListener('mouseup', (e) => {
            if (this.engine.activeTool && this.engine.activeTool.onMouseUp) {
                const command = this.engine.activeTool.onMouseUp(e);
                this.engine.dispatchCommand(command);
            } else {
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