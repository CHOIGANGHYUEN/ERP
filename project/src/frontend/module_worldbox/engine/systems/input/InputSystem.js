import System from "../../core/System";
import { GlobalLogger } from "../../utils/Logger";

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
                this.handleStart(e.clientX, e.clientY, e);
            } else if (e.button === 2) {
                this.eventBus.emit('INSPECT_REQUEST', { x: -10000, y: -10000 });
            }
        });

        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.handleMove(e.clientX, e.clientY, rect, e);
        });

        window.addEventListener('mouseup', (e) => {
            this.handleEnd();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.handleWheel(e);
        }, { passive: false });

        // 📱 Mobile Touch Support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleStart(touch.clientX, touch.clientY, e);
            } else if (e.touches.length === 2) {
                this.camera.resetPinch();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleMove(touch.clientX, touch.clientY, rect, e);
            } else if (e.touches.length === 2) {
                this.camera.handlePinch(e.touches[0], e.touches[1], rect);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleEnd();
            this.camera.resetPinch();
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'x') {
                this.engine.toggleView('view_xray');
            } else if (key === 'escape') {
                // ⌨️ [ESC] 선택 해제 및 창 닫기
                this.eventBus.emit('INSPECT_REQUEST', { x: -10000, y: -10000 });
            }
        });
    }

    // 🔧 Refactored Input Handlers for both Mouse and Touch
    handleStart(clientX, clientY, originalEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const world = this.camera.screenToWorld(clientX, clientY, rect);
        const activeTool = this.engine.toolManager?.activeTool;

        const isActionTool = activeTool && !['inspect_entity', 'grab_entity', 'move_hand'].includes(activeTool.id);
        if (!isActionTool) {
            const nearbyBuildings = this.engine.spatialHash.query(world.x, world.y, 20);
            for (const id of nearbyBuildings) {
                const ent = this.entityManager.entities.get(id);
                if (ent && ent.components.has('Door')) {
                    const door = ent.components.get('Door');
                    door.toggle();
                    this.eventBus.emitDeferred('CACHE_PIXEL_UPDATE', { x: world.x, y: world.y, reason: 'door_toggle' });
                    return;
                }
            }
        }

        if (this.engine.toolManager) {
            const cmd = this.engine.toolManager.handleMouseDown(world, originalEvent);
            if (cmd) this.engine.dispatchCommand(cmd);
        }

        if (activeTool?.id === 'grab_entity') {
            const nearest = this.findNearestEntity(world, 25);
            if (nearest) {
                this.draggedEntityId = nearest;
                const ent = this.entityManager.entities.get(nearest);
                const state = ent?.components.get('AIState');
                if (state) state.pushMode('grabbed');
                return;
            }
        }

        const isViewTool = activeTool && activeTool.id.startsWith('view_');
        if (!activeTool || activeTool.id === 'move_hand' || isViewTool) {
            let isZoneClicked = false;
            const zoneManager = this.engine.systemManager?.zoneManager;
            if (zoneManager && typeof zoneManager.handleClick === 'function') {
                isZoneClicked = zoneManager.handleClick(world.x, world.y);
            }
            if (!isZoneClicked) {
                this.camera.handleMouseDown({ clientX, clientY });
            }
        }
    }

    handleMove(clientX, clientY, rect, originalEvent) {
        const world = this.camera.screenToWorld(clientX, clientY, rect);
        this.mouseScreen = { x: clientX - rect.left, y: clientY - rect.top };
        this.mouseWorld = world;

        if (this.draggedEntityId) {
            const ent = this.entityManager.entities.get(this.draggedEntityId);
            const transform = ent?.components.get('Transform');
            if (transform) {
                transform.x = world.x;
                transform.y = world.y;
                const sh = this.engine.spatialHash;
                if (sh && typeof sh.update === 'function') {
                    sh.update(this.draggedEntityId, world.x, world.y);
                }
            }
            return;
        }

        if (this.engine.toolManager) {
            const cmd = this.engine.toolManager.handleMouseMove(world, originalEvent);
            if (cmd) this.engine.dispatchCommand(cmd);
        }

        const activeTool = this.engine.toolManager?.activeTool;
        const isViewTool = activeTool && activeTool.id.startsWith('view_');
        if (!activeTool || activeTool.id === 'move_hand' || isViewTool) {
            this.camera.handleMouseMove({ clientX, clientY, target: this.canvas });
        }
    }

    handleEnd() {
        if (this.draggedEntityId) {
            const ent = this.entityManager.entities.get(this.draggedEntityId);
            const state = ent?.components.get('AIState');
            if (state && state.mode === 'grabbed') {
                state.popMode();
            }
            this.draggedEntityId = null;
            return;
        }

        if (this.engine.toolManager) {
            const cmd = this.engine.toolManager.handleMouseUp();
            if (cmd) this.engine.dispatchCommand(cmd);
        }

        const activeTool = this.engine.toolManager?.activeTool;
        const isViewTool = activeTool && activeTool.id.startsWith('view_');
        if (!activeTool || activeTool.id === 'move_hand' || isViewTool) {
            this.camera.handleMouseUp();
        }
    }

    findNearestEntity(pos, radius) {
        if (!this.engine.spatialHash) return null;
        let nearestId = null;
        let minDistSq = radius * radius;
        
        this.engine.spatialHash.eachInRange(pos.x, pos.y, radius, (id) => {
            const ent = this.entityManager.entities.get(id);
            if (!ent) return;
            
            const transform = ent.components.get('Transform');
            if (!transform) return;
            
            const dx = transform.x - pos.x;
            const dy = transform.y - pos.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearestId = id;
            }
        });
        
        return nearestId;
    }

    update(dt, time) {
        // InputSystem은 DOM 이벤트 드리븐으로 동작하므로 매 프레임 업데이트는 비워둡니다.
    }
}