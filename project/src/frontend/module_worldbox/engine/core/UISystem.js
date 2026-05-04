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

        // EventBus를 통해 사용자의 클릭(Inspect) 명령을 수신합니다.
        this.eventBus.on('INSPECT_REQUEST', (worldPos) => {
            this.handleSelect(worldPos);
        });
    }

    /** 📜 로깅 뷰어 UI 생성 및 바인딩 */
    initLogUI() {
        const createUI = () => {
            if (!document.body) return;

            // 1. 로그 컨테이너 생성
            this.logContainer = document.createElement('div');
            this.logContainer.id = 'worldbox-log-container';
            Object.assign(this.logContainer.style, {
                position: 'fixed',
                bottom: '70px',
                right: '20px',
                width: '350px',
                height: '450px',
                backgroundColor: 'rgba(13, 25, 41, 0.9)',
                backdropFilter: 'blur(15px)',
                color: '#e3f2fd',
                fontFamily: "'Cascadia Code', 'Consolas', monospace",
                fontSize: '11px',
                padding: '12px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                overflowY: 'auto',
                display: 'none',
                zIndex: '999999',
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                scrollbarWidth: 'thin'
            });

            // 2. 토글 버튼 생성
            this.logToggleButton = document.createElement('button');
            this.logToggleButton.innerHTML = '<span style="margin-right:8px;">📜</span>SYSTEM LOGS';
            Object.assign(this.logToggleButton.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                padding: '10px 20px',
                backgroundColor: '#0288d1',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '30px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                zIndex: '1000000',
                boxShadow: '0 4px 20px rgba(2, 136, 209, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
            });

            this.logToggleButton.onmouseover = () => {
                this.logToggleButton.style.backgroundColor = '#03a9f4';
                this.logToggleButton.style.transform = 'translateY(-2px)';
            };
            this.logToggleButton.onmouseout = () => {
                this.logToggleButton.style.backgroundColor = '#0288d1';
                this.logToggleButton.style.transform = 'translateY(0)';
            };
            
            this.logToggleButton.onclick = () => {
                const isVisible = this.logContainer.style.display === 'block';
                const nextState = isVisible ? 'none' : 'block';
                
                this.logContainer.style.display = nextState;
                if (this.monitorContainer) this.monitorContainer.style.display = nextState;
                
                if (!isVisible) {
                    this.logContainer.scrollTop = 0; 
                    this.refreshMonitor();
                }
            };

            document.body.appendChild(this.logContainer);
            document.body.appendChild(this.logToggleButton);

            // 3. 로거 콜백 등록 (직접 렌더링 대신 데이터 캐싱 및 플래그 설정)
            GlobalLogger.onUpdate = (logs) => {
                this.cachedLogs = logs;
                this.logDirty = true;
            };
            
            GlobalLogger.success('LOGGING SYSTEM READY: Monitoring world events...');
        };

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            createUI();
        } else {
            window.addEventListener('DOMContentLoaded', createUI);
        }
    }

    /** 📊 월드 실시간 모니터링 UI 생성 */
    initMonitorUI() {
        const createUI = () => {
            if (!document.body) return;

            this.monitorContainer = document.createElement('div');
            this.monitorContainer.id = 'worldbox-monitor-container';
            Object.assign(this.monitorContainer.style, {
                position: 'fixed',
                bottom: '70px',
                right: '380px',
                width: '240px',
                height: 'auto',
                maxHeight: '400px',
                backgroundColor: 'rgba(7, 15, 25, 0.85)',
                backdropFilter: 'blur(20px)',
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'none',
                zIndex: '999998',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                transition: 'all 0.3s ease'
            });

            document.body.appendChild(this.monitorContainer);
        };

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            createUI();
        } else {
            window.addEventListener('DOMContentLoaded', createUI);
        }
    }

    refreshMonitor() {
        if (!this.monitorContainer || this.monitorContainer.style.display === 'none') return;

        const stats = {
            population: 0,
            villages: 0,
            animals: 0,
            resources: { food: 0, wood: 0, stone: 0, iron_ore: 0 }
        };

        // 🛡️ [Performance Safety] 엔티티가 너무 많으면 집계를 건너뛰거나 샘플링
        const entityCount = this.entityManager.entities.size;
        if (entityCount > 5000) {
            this.monitorContainer.innerHTML = `<div style="color:#ff5252; font-size:10px;">⚠️ Too many entities to monitor (${entityCount})</div>`;
            return;
        }

        for (const [id, ent] of this.entityManager.entities) {
            if (ent.components.has('Civilization')) stats.population++;
            if (ent.components.has('Animal') && !ent.components.has('Civilization')) stats.animals++;
            
            const storage = ent.components.get('Storage');
            if (storage) {
                for (const type in stats.resources) {
                    stats.resources[type] += (storage.items[type] || 0);
                }
            }
        }

        stats.villages = this.engine.systemManager?.villageSystem?.villages?.size || 0;

        this.monitorContainer.innerHTML = `
            <div style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 800; color: #ffeb3b; font-size: 13px; letter-spacing: 1px;">📊 WORLD MONITOR</span>
                <span style="font-size: 10px; opacity: 0.6;">LIVE</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 10px; opacity: 0.5;">POPULATION</div>
                    <div style="font-size: 18px; font-weight: 800; color: #4fc3f7;">${stats.population}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 10px; opacity: 0.5;">VILLAGES</div>
                    <div style="font-size: 18px; font-weight: 800; color: #f48fb1;">${stats.villages}</div>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-size: 11px; margin-bottom: 6px; color: #81c784; font-weight: 700;">🐾 WILDLIFE</div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px;">
                    <span>Total Animals</span>
                    <span style="font-weight: 800;">${stats.animals}</span>
                </div>
            </div>

            <div>
                <div style="font-size: 11px; margin-bottom: 6px; color: #ffb74d; font-weight: 700;">📦 GLOBAL STORAGE</div>
                <div style="display: grid; gap: 4px;">
                    ${Object.entries(stats.resources).map(([type, val]) => `
                        <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
                            <span style="opacity: 0.7;">${type.toUpperCase()}</span>
                            <span style="font-weight: 700; color: ${val > 100 ? '#fff' : '#ff5252'}">${Math.floor(val)}</span>
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
        if (!this.logContainer || this.logContainer.style.display === 'none' || !this.logDirty) return;

        const fragment = document.createDocumentFragment();
        const header = document.createElement('div');
        header.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 10px; font-weight: 800; color: #4fc3f7; text-transform: uppercase; letter-spacing: 1px;';
        header.innerHTML = '📋 System Activity Log';
        fragment.appendChild(header);

        // 최신 100개만 우선 렌더링하여 DOM 부하 방지
        const visibleLogs = this.cachedLogs.slice(0, 100);

        visibleLogs.forEach(log => {
            const div = document.createElement('div');
            div.style.cssText = 'margin-bottom: 6px; line-height: 1.5; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.03); border-left: 3px solid transparent;';
            
            let color = '#e0e0e0';
            let borderColor = 'transparent';
            
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
            div.innerHTML = `<span style="color: rgba(255,255,255,0.3); font-size: 9px; margin-right: 8px;">${log.timestamp}</span><span style="color: ${color}">${log.message}</span>`;
            fragment.appendChild(div);
        });

        this.logContainer.innerHTML = '';
        this.logContainer.appendChild(fragment);
        this.logDirty = false;
    }

    handleSelect(worldPos) {
        let nearest = null;
        let minDist = 30;

        for (const [id, entity] of this.entityManager.entities) {
            const t = entity.components.get('Transform');
            if (t) {
                const dist = Math.sqrt((t.x - worldPos.x) ** 2 + (t.y - worldPos.y) ** 2);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = id;
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
            diet: a?.diet || s?.diet || null
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