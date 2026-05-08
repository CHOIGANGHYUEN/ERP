import System from "./System";
import { GlobalLogger } from "../utils/Logger.js";

/**
 * 🖥️ UISystem
 * 게임의 로그, 월드 모니터링, 엔티티 상세 정보창을 관리하는 시스템입니다.
 */
export default class UISystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.selectedId = null;
        this.monitorUpdateTimer = 0;
        this.logUpdateTimer = 0;
        this.logDirty = false;
        this.cachedLogs = [];

        // 📜 로깅 UI 및 📊 모니터 UI 초기화
        this.initLogUI();
        this.initMonitorUI();

        // Window state management
        this.panelState = {
            logs: { collapsed: false, visible: false, x: window.innerWidth - 370, y: window.innerHeight - 530 },
            monitor: { collapsed: false, visible: false, x: window.innerWidth - 630, y: window.innerHeight - 530 }
        };

        // EventBus를 통해 사용자의 클릭(Inspect) 명령을 수신합니다.
        this.eventBus.on('INSPECT_REQUEST', (worldPos) => {
            this.handleSelect(worldPos);
        });
    }

    /** 🚀 [Expert Interface] 드래그 가능하게 만들기 */
    makeDraggable(element, handle, stateKey) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragMouseDown.bind(this);

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag.bind(this);
            handle.style.cursor = 'grabbing';
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            const newY = element.offsetTop - pos2;
            const newX = element.offsetLeft - pos1;
            
            element.style.top = newY + "px";
            element.style.left = newX + "px";
            element.style.bottom = 'auto';
            element.style.right = 'auto';
            
            // Save state
            if (this.panelState[stateKey]) {
                this.panelState[stateKey].x = newX;
                this.panelState[stateKey].y = newY;
            }
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            handle.style.cursor = 'grab';
        }
    }

    initLogUI() {
        const createUI = () => {
            if (!document.body) return;

            // 1. 로그 컨테이너 생성
            this.logContainer = document.createElement('div');
            this.logContainer.id = 'worldbox-log-container';
            Object.assign(this.logContainer.style, {
                position: 'fixed',
                top: (window.innerHeight - 530) + 'px',
                left: (window.innerWidth - 370) + 'px',
                width: '350px',
                height: '450px',
                backgroundColor: 'rgba(10, 15, 25, 0.85)',
                backdropFilter: 'blur(25px)',
                color: '#e3f2fd',
                fontFamily: "'Inter', sans-serif",
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'none',
                zIndex: '999999',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                display: 'none',
                flexDirection: 'column'
            });

            // 2. Header (Draggable)
            const header = document.createElement('div');
            header.id = 'log-header';
            Object.assign(header.style, {
                padding: '14px 18px',
                background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'grab',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                userSelect: 'none'
            });
            header.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:14px;">📜</span>
                    <span style="font-size:0.75rem; font-weight:900; letter-spacing:2px; color:#4fc3f7;">SYSTEM ACTIVITY</span>
                </div>
                <div style="display:flex; gap:8px;">
                    <button id="log-collapse-btn" style="background:none; border:none; color:#888; cursor:pointer; font-size:16px;">−</button>
                    <button id="log-close-btn" style="background:none; border:none; color:#888; cursor:pointer; font-size:16px;">✕</button>
                </div>
            `;
            this.logContainer.appendChild(header);

            // 3. Content Area
            this.logContent = document.createElement('div');
            Object.assign(this.logContent.style, {
                flex: '1',
                overflowY: 'auto',
                padding: '15px',
                fontFamily: "'Cascadia Code', monospace",
                fontSize: '11px'
            });
            this.logContainer.appendChild(this.logContent);

            // 4. Toggle Button
            this.logToggleButton = document.createElement('button');
            this.logToggleButton.innerHTML = '<span style="margin-right:10px; font-size:16px;">📋</span>LOGS & MONITOR';
            Object.assign(this.logToggleButton.style, {
                position: 'fixed',
                bottom: '25px',
                right: '25px',
                padding: '12px 24px',
                backgroundColor: 'rgba(2, 136, 209, 0.9)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '30px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '900',
                letterSpacing: '1px',
                zIndex: '1000000',
                boxShadow: '0 8px 32px rgba(2, 136, 209, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            });

            this.logToggleButton.onclick = () => {
                const isVisible = this.logContainer.style.display === 'flex';
                const nextState = isVisible ? 'none' : 'flex';
                this.logContainer.style.display = nextState;
                if (this.monitorContainer) this.monitorContainer.style.display = nextState;
                this.logToggleButton.style.transform = isVisible ? 'scale(1)' : 'scale(0.95)';
                this.logToggleButton.style.backgroundColor = isVisible ? 'rgba(2, 136, 209, 0.9)' : 'rgba(2, 136, 209, 1)';
            };

            document.body.appendChild(this.logContainer);
            document.body.appendChild(this.logToggleButton);

            // Functionality
            this.makeDraggable(this.logContainer, header, 'logs');
            
            const collapseBtn = header.querySelector('#log-collapse-btn');
            collapseBtn.onclick = () => {
                const isCollapsed = this.logContent.style.display === 'none';
                this.logContent.style.display = isCollapsed ? 'block' : 'none';
                this.logContainer.style.height = isCollapsed ? '450px' : 'auto';
                collapseBtn.innerText = isCollapsed ? '−' : '+';
            };

            const closeBtn = header.querySelector('#log-close-btn');
            closeBtn.onclick = () => {
                this.logContainer.style.display = 'none';
                if (this.monitorContainer) this.monitorContainer.style.display = 'none';
            };

            GlobalLogger.onUpdate = (logs) => {
                this.cachedLogs = logs;
                this.logDirty = true;
            };
        };

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            createUI();
        } else {
            window.addEventListener('DOMContentLoaded', createUI);
        }
    }

    initMonitorUI() {
        const createUI = () => {
            if (!document.body) return;

            this.monitorContainer = document.createElement('div');
            this.monitorContainer.id = 'worldbox-monitor-container';
            Object.assign(this.monitorContainer.style, {
                position: 'fixed',
                top: (window.innerHeight - 530) + 'px',
                left: (window.innerWidth - 630) + 'px',
                width: '250px',
                height: 'auto',
                backgroundColor: 'rgba(7, 15, 25, 0.85)',
                backdropFilter: 'blur(25px)',
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'none',
                zIndex: '999998',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                flexDirection: 'column'
            });

            // Header (Draggable)
            const header = document.createElement('div');
            Object.assign(header.style, {
                padding: '14px 18px',
                background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'grab',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                userSelect: 'none'
            });
            header.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:14px;">📊</span>
                    <span style="font-size:0.7rem; font-weight:900; letter-spacing:2px; color:#ffd54f;">WORLD MONITOR</span>
                </div>
                <div style="display:flex; gap:8px;">
                    <button id="mon-collapse-btn" style="background:none; border:none; color:#888; cursor:pointer; font-size:16px;">−</button>
                    <button id="mon-close-btn" style="background:none; border:none; color:#888; cursor:pointer; font-size:16px;">✕</button>
                </div>
            `;
            this.monitorContainer.appendChild(header);

            this.monitorContent = document.createElement('div');
            Object.assign(this.monitorContent.style, {
                padding: '16px',
                maxHeight: '400px',
                overflowY: 'auto'
            });
            this.monitorContainer.appendChild(this.monitorContent);

            document.body.appendChild(this.monitorContainer);

            // Functionality
            this.makeDraggable(this.monitorContainer, header, 'monitor');

            const collapseBtn = header.querySelector('#mon-collapse-btn');
            collapseBtn.onclick = () => {
                const isCollapsed = this.monitorContent.style.display === 'none';
                this.monitorContent.style.display = isCollapsed ? 'block' : 'none';
                collapseBtn.innerText = isCollapsed ? '−' : '+';
            };

            const closeBtn = header.querySelector('#mon-close-btn');
            closeBtn.onclick = () => {
                this.monitorContainer.style.display = 'none';
                if (this.logContainer) this.logContainer.style.display = 'none';
            };
        };

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            createUI();
        } else {
            window.addEventListener('DOMContentLoaded', createUI);
        }
    }

    refreshMonitor() {
        if (!this.monitorContent || this.monitorContainer.style.display === 'none') return;
        
        const stats = {
            population: 0,
            villages: 0,
            nations: [],
            animals: 0,
            resources: { food: 0, wood: 0, stone: 0, iron_ore: 0 }
        };

        // 🚀 [Expert Optimization] Use pre-aggregated data from systems
        const vs = this.engine.systemManager?.villageSystem;
        const ns = this.engine.systemManager?.nationSystem;
        
        stats.population = this.entityManager.humanIds.size;
        stats.animals = this.entityManager.animalIds.size - stats.population;
        stats.villages = vs?.villages.size || 0;

        if (ns) {
            for (const nation of ns.nations.values()) {
                stats.nations.push({
                    id: nation.id,
                    name: nation.name,
                    color: nation.color,
                    population: nation.totalPopulation,
                    villageCount: nation.villages.size,
                    resources: { ...nation.resources },
                    prestige: Math.floor(nation.prestige || 0)
                });
            }
        }

        // Global Stocks from all villages
        if (vs) {
            for (const v of vs.villages.values()) {
                for (const type in stats.resources) {
                    stats.resources[type] += (v.resources?.[type] || 0);
                }
            }
        }

        this.monitorContent.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 9px; font-weight: 800; color: #888; margin-bottom: 4px;">PEOPLE</div>
                    <div style="font-size: 18px; font-weight: 900; color: #4fc3f7;">${stats.population}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 9px; font-weight: 800; color: #888; margin-bottom: 4px;">VILLAGES</div>
                    <div style="font-size: 18px; font-weight: 900; color: #f48fb1;">${stats.villages}</div>
                </div>
            </div>

            <div style="margin-bottom: 15px; display: flex; justify-content: space-between; font-size: 11px; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <span style="color: #81c784; font-weight: 800;">🐾 WILDLIFE</span>
                <span style="font-weight: 900; color: #fff;">${stats.animals}</span>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-size: 10px; margin-bottom: 8px; color: #ffd54f; font-weight: 900; letter-spacing: 1px;">NATIONS</div>
                <div style="display: grid; gap: 8px;">
                    ${stats.nations.map(n => `
                        <div style="background: rgba(255,255,255,0.04); padding: 10px; border-radius: 12px; border-left: 4px solid ${n.color};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: 800; font-size: 0.8rem;">${n.name}</span>
                                <span style="font-size: 9px; background: rgba(255,215,0,0.2); color: #ffd700; padding: 2px 6px; border-radius: 6px; font-weight: 800;">🏆 ${n.prestige}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 9px; opacity: 0.8; font-weight: 600;">
                                <span>👤 ${n.population} Pop</span>
                                <span>🏘️ ${n.villageCount} Vil</span>
                                <span>🪵 ${Math.floor(n.resources.wood)} Wood</span>
                                <span>🍎 ${Math.floor(n.resources.food)} Food</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div>
                <div style="font-size: 10px; margin-bottom: 8px; color: #ffb74d; font-weight: 900; letter-spacing: 1px;">GLOBAL STOCK</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    ${Object.entries(stats.resources).map(([type, val]) => `
                        <div style="display: flex; justify-content: space-between; font-size: 10px; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                            <span style="opacity: 0.6; font-weight: 800;">${type.slice(0, 4).toUpperCase()}</span>
                            <span style="font-weight: 900;">${Math.floor(val)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 🚀 [High Performance] 실제 DOM 렌더링 수행
     * 백그라운드에서 쌓인 로그를 배치로 처리합니다.
     */
    renderLogs() {
        if (!this.logContent || this.logContainer.style.display === 'none' || !this.logDirty) return;

        const fragment = document.createDocumentFragment();
        const visibleLogs = this.cachedLogs.slice(0, 50);

        visibleLogs.forEach(log => {
            const div = document.createElement('div');
            div.style.cssText = 'margin-bottom: 6px; line-height: 1.4; padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,0.03); border-left: 3px solid transparent; font-size: 10px;';
            
            let color = '#cfd8dc';
            let borderColor = 'rgba(255,255,255,0.1)';
            
            if (log.type === 'warn') {
                color = '#ffd54f';
                borderColor = '#ffd54f';
            } else if (log.type === 'error') {
                color = '#ff5252';
                borderColor = '#ff5252';
            } else if (log.type === 'success') {
                color = '#69f0ae';
                borderColor = '#69f0ae';
            }
            
            div.style.borderLeftColor = borderColor;
            div.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span style="color:rgba(255,255,255,0.2); font-size:8px;">${log.timestamp}</span></div><div style="color: ${color}">${log.message}</div>`;
            fragment.appendChild(div);
        });

        this.logContent.innerHTML = '';
        this.logContent.appendChild(fragment);
        this.logDirty = false;
    }

    handleSelect(worldPos) {
        let nearest = null;
        let bestScore = 2500; // 50^2 (최대 탐색 반경)

        // 🚀 [Expert Optimization] 가중치 기반 우선순위 선택 (인간/건물 > 동물 > 식물)
        if (this.engine.spatialHash) {
            this.engine.spatialHash.eachInSpiral(worldPos.x, worldPos.y, 50, (id) => {
                const entity = this.entityManager.entities.get(id);
                if (!entity) return false;
                
                const t = entity.components.get('Transform');
                if (t) {
                    const dx = t.x - worldPos.x;
                    const dy = t.y - worldPos.y;
                    let distSq = dx * dx + dy * dy;

                    // 🎯 우선순위 가중치 적용 (중요한 개체는 더 멀리 있어도 클릭된 것으로 간주)
                    const isHuman = entity.components.has('Civilization');
                    const isBuilding = entity.components.has('Building');
                    const isAnimal = entity.components.has('Animal');

                    if (isHuman || isBuilding) distSq -= 400; // 약 20px 만큼의 거리 보너스
                    else if (isAnimal) distSq -= 100;         // 약 10px 만큼의 거리 보너스

                    if (distSq < bestScore) {
                        bestScore = distSq;
                        nearest = id;
                    }
                }
                return false; 
            });
        } else {
            // Fallback: SpatialHash가 없을 경우
            for (const [id, entity] of this.entityManager.entities) {
                const t = entity.components.get('Transform');
                if (t) {
                    const dx = t.x - worldPos.x;
                    const dy = t.y - worldPos.y;
                    let distSq = dx * dx + dy * dy;
                    
                    if (entity.components.has('Civilization') || entity.components.has('Building')) distSq -= 400;
                    
                    if (distSq < bestScore) {
                        bestScore = distSq;
                        nearest = id;
                    }
                }
            }
        }

        this.selectedId = nearest;
        this.eventBus.emit('ENTITY_SELECTED', nearest); 
        this.syncUI();
    }

    syncUI() {
        if (this.selectedId && this.engine.onEntitySelect) {
            const data = this.getEntityData(this.selectedId);
            if (data) {
                this.engine.onEntitySelect(data);
            } else {
                this.selectedId = null;
                this.eventBus.emit('ENTITY_SELECTED', null);
                this.engine.onEntitySelect(null);
            }
        } else if (!this.selectedId && this.engine.onEntitySelect) {
            this.engine.onEntitySelect(null);
        }
    }

    getEntityData(id) {
        const target = this.entityManager.entities.get(id);
        if (!target) return null;

        const m = target.components.get('Metabolism');
        const s = target.components.get('BaseStats'); 
        const a = target.components.get('Animal');
        const v = target.components.get('Visual');
        const r = target.components.get('Resource');
        const stateComp = target.components.get('AIState');
        const ageComp = target.components.get('Age');
        const civ = target.components.get('Civilization');

        let name = 'Unknown';
        let type = v?.type || a?.type || 'unknown';
        let subType = v?.treeType || v?.role || null;
        let state = 'Normal';

        let isChief = false;
        if (civ && civ.villageId !== -1) {
            const vs = this.engine.systemManager?.villageSystem;
            const village = vs?.getVillage(civ.villageId);
            if (village && village.chiefId === id) isChief = true;
        }

        let currentTask = null;
        if (civ && civ.role && civ.role.currentTask) {
            const task = civ.role.currentTask;
            currentTask = {
                id: task.id,
                type: task.type,
                priority: task.priority
            };
        }

        let fertility = s ? (s.storedFertility || 0) : (m?.storedFertility || r?.storedFertility || 0);
        let inhabitants = null;
        let animalYield = null;

        if (type === 'tree') {
            name = subType === 'beehive' ? 'Beehive Tree' : (subType === 'fruit' ? 'Fruit Tree' : 'Tree');
            state = v?.isWithered ? 'Withered' : 'Healthy';

            if (subType === 'beehive') {
                // 🚀 [Optimization] 매 프레임 수천 개의 엔티티를 순회하지 않도록 수정
                inhabitants = { queen: 'LIVE', worker: 'BUSY', honey: Math.floor(r?.honey || 0) };
            }
        } else if (type === 'flower') {
            name = 'Flower';
            state = (v?.quality < 0.4) ? 'Withered' : 'Blooming';
        } else if (r?.isGrass) {
            name = 'Grass';
            type = 'grass';
            state = (v?.quality < 0.4) ? 'Withered' : 'Healthy';
        } else if (type === 'building') {
            const buildingComp = target.components.get('Building');
            const structure = target.components.get('Structure');
            const subtypeName = (buildingComp?.type || v?.subtype || 'Building').toUpperCase();

            if (structure && !structure.isComplete) {
                name = `${subtypeName} (PLAN)`;
                const progress = Math.floor((structure.progress / structure.maxProgress) * 100);
                state = `CONSTRUCTING (${progress}%)`;
            } else {
                name = subtypeName;
                state = 'OPERATIONAL';
            }
        } else if (a) {
            name = a.type.charAt(0).toUpperCase() + a.type.slice(1);
            if (a.isBaby) name = 'Baby ' + name;
            state = stateComp?.mode || 'wander';

            if (a.type === 'cow') {
                subType = v?.cowType;
                name = subType === 'dairy' ? 'Dairy Cow' : 'Beef Cow';
                if (r) {
                    animalYield = subType === 'dairy' ? `🍼 Milk: ${r.amount} | 🥩 Meat: ${r.meat}` : `🥩 Meat: ${r.amount}`;
                }
            }
        }

        const normalizedFertility = a ? Math.min(1.0, fertility / 15.0) : fertility;

        const jobCtrl = target.components.get('JobController');
        let targetId = stateComp?.targetId || stateComp?.storageTargetId || jobCtrl?.targetId || null;
        let targetName = "None";

        if (targetId) {
            if (stateComp?.targetName) {
                targetName = stateComp.targetName;
            } else if (targetId === 'wander_pos') {
                targetName = "WANDERING...";
            } else {
                const tEnt = this.entityManager.entities.get(targetId);
                if (tEnt) {
                    const tVis = tEnt.components.get('Visual');
                    const tAnim = tEnt.components.get('Animal');
                    const tRes = tEnt.components.get('Resource');
                    const tStruc = tEnt.components.get('Structure');
                    targetName = (tStruc?.type || tRes?.type || tAnim?.type || tVis?.type || 'Entity').toUpperCase();
                    const subType = tVis?.subType || tVis?.treeType || tVis?.role || tAnim?.role;
                    if (subType) targetName += ` (${subType})`;
                } else {
                    targetName = "LOST TARGET";
                }
            }
        } else if (stateComp?.isTargetRequested || jobCtrl?.isTargetRequested) {
            targetName = "SEARCHING...";
        }

        const inv = target.components.get('Inventory');
        const storage = target.components.get('Storage');
        let inventoryData = null;

        if (inv || storage) {
            const items = inv ? { ...inv.items } : { ...storage.items };
            const total = inv ? inv.getTotal() : Object.values(storage.items).reduce((a, b) => a + b, 0);
            const capacity = inv ? inv.capacity : storage.capacity;

            inventoryData = {
                items,
                total,
                capacity
            };
        }

        let villageData = null;
        if (civ && civ.villageId !== -1) {
            const vs = this.engine.systemManager?.villageSystem;
            const village = vs?.getVillage(civ.villageId);
            if (village) {
                villageData = {
                    id: village.id,
                    name: village.name,
                    type: village.type,
                    buffs: { ...village.buffs }
                };
            }
        }

        return {
            id: target.id, type: type, subType: subType, name: name, state: state,
            hunger: s ? s.hunger : m?.stomach,
            maxHunger: s ? (s.maxHunger || 100) : m?.maxStomach,
            health: s?.health || 0,
            maxHealth: s?.maxHealth || 100,
            fatigue: s?.fatigue || 0,
            fertility: normalizedFertility,
            quality: v?.quality, inhabitants: inhabitants, resourceValue: r?.value || r?.amount || 0,
            animalYield: animalYield,
            rank: a?.rank,
            jobType: civ?.jobType || null,
            isChief: isChief,
            currentTask: currentTask,
            targetId: targetId,
            targetName: targetName,
            inventory: inventoryData,
            age: ageComp?.currentAge,
            growthStage: ageComp?.growthStage,
            modeStackCount: stateComp?.modeStack?.length || 0,
            diet: a?.diet || s?.diet || null,
            village: villageData // 🏘️ 마을 정보 추가
        };
    }

    update(dt, time) {
        if (this.selectedId) {
            this.syncUI();
        }

        this.monitorUpdateTimer += dt;
        if (this.monitorUpdateTimer >= 0.5) {
            this.monitorUpdateTimer = 0;
            this.refreshMonitor();
        }

        // 📜 로그 UI 고속 배치 업데이트 (0.1초 간격)
        this.logUpdateTimer += dt;
        if (this.logUpdateTimer >= 0.1) {
            this.logUpdateTimer = 0;
            this.renderLogs();
        }
    }
}