import { DefaultTools } from './ToolRegistry.js';
import { GlobalLogger } from '../utils/Logger.js';

/**
 * 🛠️ ToolManager
 * 현재 활성화된 도구를 관리하고 입력 이벤트를 도구의 로직으로 중계합니다.
 */
export default class ToolManager {
    constructor(engine) {
        this.engine = engine;
        this.tools = new Map();
        this.activeTool = null;

        this._initTools();
    }

    _initTools() {
        const tools = DefaultTools(this.engine);
        tools.forEach(tool => {
            this.tools.set(tool.id, tool);
        });

        // 기본 도구 설정 (Move/Inspect 등)
        this.setTool('move_hand');
    }

    setTool(toolId) {
        const tool = this.tools.get(toolId);
        if (tool) {
            this.activeTool = tool;
            GlobalLogger.info(`🛠️ Tool Switched: ${tool.name}`);
            
            // UI에 상태 동기화 (필요시 EventBus 활용)
            if (this.engine.eventBus) {
                this.engine.eventBus.emit('TOOL_CHANGED', { toolId });
            }
        }
    }

    /**
     * 🚀 마우스 입력을 현재 도구에 전달합니다. (전략 패턴 실행 지점)
     */
    handleMouseDown(worldPos, event) {
        if (!this.activeTool) return;
        
        const action = this.activeTool.onMouseDown(worldPos, event, this.engine);
        if (action) {
            this.engine.dispatchCommand(action);
        }
    }

    handleMouseMove(worldPos, event) {
        if (!this.activeTool) return;

        const action = this.activeTool.onMouseMove(worldPos, event, this.engine);
        if (action) {
            this.engine.dispatchCommand(action);
        }
    }

    handleMouseUp(event) {
        if (!this.activeTool) return;

        const action = this.activeTool.onMouseUp(event, this.engine);
        if (action) {
            this.engine.dispatchCommand(action);
        }
    }

    getTool(toolId) {
        return this.tools.get(toolId);
    }
}
