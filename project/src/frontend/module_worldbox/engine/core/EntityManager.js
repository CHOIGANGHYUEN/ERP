import ResourceNode from '../components/resource/ResourceNode.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';
import resourceConfig from '../config/resource_balance.json'; // resource_balance.json 임포트

export default class EntityManager {
    constructor() {
        this.entities = new Map();
        this.animalIds = new Set();
        this.humanIds = new Set(); 
        this.resourceIds = new Set();
        this.buildingIds = new Set();
        this.nextId = 0;
        this.entityPool = []; 

        // 🚀 [Expert Optimization] TypedArray 기반 컴포넌트 데이터 캐싱 (DOD)
        this.maxEntities = 10000;
        this.transformBuffer = new Float32Array(this.maxEntities * 4); // [x, y, vx, vy, ...]
        this.statsBuffer = new Float32Array(this.maxEntities * 4);     // [hp, hunger, fatigue, speed, ...]
    }

    createEntity() {
        let id;
        if (this.entityPool.length > 0) {
            id = this.entityPool.pop();
        } else {
            id = this.nextId++;
            this._ensureBufferCapacity(id);
        }

        this.entities.set(id, { id, components: new Map() });
        return id;
    }

    /** 🚀 버퍼 용량 자동 확장 */
    _ensureBufferCapacity(id) {
        if (id < this.maxEntities) return;
        
        const newMax = Math.max(id + 1, this.maxEntities * 2);
        const newTransform = new Float32Array(newMax * 4);
        const newStats = new Float32Array(newMax * 4);
        
        newTransform.set(this.transformBuffer);
        newStats.set(this.statsBuffer);
        
        this.transformBuffer = newTransform;
        this.statsBuffer = newStats;
        this.maxEntities = newMax;
        console.log(`📏 EntityManager: Buffer resized to ${newMax} slots.`);
    }

    removeEntity(id, spatialHash = null) {
        const entity = this.entities.get(id);
        if (entity) {
            // 🚀 [Synchronization] 공간 해시에서 즉시 제거 (유령 타겟 방지)
            const sh = spatialHash || this.spatialHash;
            if (sh) {
                const transform = entity.components.get('Transform');
                if (transform) {
                    sh.remove(id, transform.x, transform.y);
                }
            }

            const building = entity.components.get('Building');
            if (building) {
                console.warn(`🏢 Removing Building Entity! ID: ${id}, Type: ${building.type}`);
            }
            
            this.animalIds.delete(id);
            this.humanIds.delete(id); // 👤 인간 인덱스 제거
            this.resourceIds.delete(id);
            this.buildingIds.delete(id);
            
            // 🚀 [Memory Optimization] 컴포넌트 맵을 명시적으로 비워 참조 해제
            entity.components.clear();
            
            this.entities.delete(id); // 활성 맵에서는 제거
            this.entityPool.push(id); // 재활용 대기소로 이동
        }
    }

    /**
     * 모든 엔티티 정보를 초기화합니다. (시뮬레이션 재시작용)
     */
    clearAll() {
        this.entities.clear();
        this.animalIds.clear();
        this.humanIds.clear();
        this.resourceIds.clear();
        this.buildingIds.clear();
        this.entityPool = [];
        this.nextId = 0;
    }

    addComponent(entityId, component, overrideName = null) {
        const entity = this.entities.get(entityId);
        if (entity) {
            let name = overrideName || component.constructor.name;
            
            // 🚀 [FIX] 일반 객체({})로 전달된 경우 클래스 이름이 'Object'가 되는 문제 방지
            if (name === 'Object') {
                if (component.type === 'wood' || component.isTree) name = 'Resource';
                else if (component.edible || component.type === 'food') name = 'Resource';
                else if (component.isBlueprint || component.progress !== undefined) name = 'Structure';
                else if (component.villageId !== undefined || component.maxHealth !== undefined) name = 'Building';
            }

            entity.components.set(name, component);
            
            // 🚀 [Expert Optimization] TypedArray 버퍼 연결 (DOD)
            if (name === 'Transform') {
                if (component.linkBuffer) component.linkBuffer(this.transformBuffer, entityId * 4);
            } else if (name === 'BaseStats') {
                if (component.linkBuffer) component.linkBuffer(this.statsBuffer, entityId * 4);
            }

            if (name === 'Animal') {
                this.animalIds.add(entityId);
                if (component.type === 'human') this.humanIds.add(entityId);
            }
            if (name === 'Resource' || name === 'DroppedItem') this.resourceIds.add(entityId);
            if (name === 'Building' || name === 'Structure') this.buildingIds.add(entityId);
        }
    }

    createResourceNode(x, y, type, amount) {
        const id = this.createEntity();
        this.addComponent(id, new Transform(x, y));
        this.addComponent(id, new ResourceNode(type, amount), 'Resource');

        // Visual based on resource type
        // resource_balance.json에서 해당 자원의 색상 정보를 가져옵니다.
        const resourceInfo = resourceConfig[type];
        let color = resourceInfo && resourceInfo.color ? resourceInfo.color : null;

        if (!color) {
            // 속성 기반 자동 색상 부여 (JSON에 color 속성이 없을 때의 Fallback)
            if (type.includes('gold')) color = '#fbc02d';
            else if (type.includes('silver')) color = '#e0e0e0';
            else if (type.includes('copper')) color = '#d84315';
            else if (type.includes('iron')) color = '#6d4c41';
            else if (type.includes('coal') || type.includes('obsidian')) color = '#212121';
            else if (type.includes('gems')) color = '#e040fb';
            else if (type.includes('stone') || type.includes('gravel') || type.includes('flint')) color = '#9e9e9e';
            else if (type.includes('sand')) color = '#f4d03f';
            else if (type.includes('clay') || type.includes('mud')) color = '#8d6e63';
            else if (type.includes('salt')) color = '#ffffff';
            else if (resourceInfo && resourceInfo.type === 'mineral') color = '#9e9e9e';
            else if (resourceInfo && (resourceInfo.type === 'wood' || type.includes('tree'))) color = '#5d4037';
            else if (resourceInfo && resourceInfo.type === 'food') color = '#4caf50';
            else color = '#ffffff';
        }

        this.addComponent(id, new Visual(color));
        return id;
    }

    getEntitiesByComponent(componentName) {
        return Array.from(this.entities.values()).filter(e => e.components.has(componentName));
    }

    findNearestEntityWithComponent(x, y, radius, condition, spatialHash = null) {
        let nearestId = null;
        let minDistSq = radius * radius;

        if (spatialHash) {
            // 🚀 [Expert Optimization] Spiral Search 적용
            // 가까운 격자부터 탐색하여 일찍 발견하면 중단 가능
            spatialHash.eachInSpiral(x, y, radius, (id) => {
                const entity = this.entities.get(id);
                if (!entity) return false;
                
                if (condition && !condition(entity)) return false;

                const transform = entity.components.get('Transform');
                if (!transform) return false;

                const dx = transform.x - x;
                const dy = transform.y - y;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                    
                    // 🎯 [Expert Exit] 만약 충분히 가까운(예: 50px) 대상을 찾았다면 검색을 조기에 종료할 수 있음
                    // (완벽한 '가장 가까운 것'이 아닐 수 있지만 AI 탐색용으로는 충분)
                    if (minDistSq < 1600) return true; // 40px 이내면 즉시 확정
                }
                
                // 만약 이미 찾은 대상이 현재 격자(shell)의 최소 가능 거리보다 가깝다면 중단 검토 가능
                // (eachInSpiral이 shell 단위로 돌기 때문에 shell이 커질수록 distSq의 최소값도 커짐)
                return false;
            });
        } else {
            // Fallback for non-spatial searches
            for (const [id, entity] of this.entities) {
                if (condition && !condition(entity)) continue;
                const transform = entity.components.get('Transform');
                if (!transform) continue;
                const dx = transform.x - x;
                const dy = transform.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }
        }

        return nearestId;
    }
}