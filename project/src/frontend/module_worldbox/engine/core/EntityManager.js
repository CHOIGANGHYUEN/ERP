import ResourceNode from '../components/resource/ResourceNode.js';
import Transform from '../components/motion/Transform.js';
import Visual from '../components/render/Visual.js';
import { factoryProvider } from '../factories/core/FactoryProvider.js';
import resourceConfig from '../config/resource_balance.json'; // resource_balance.json 임포트

export default class EntityManager {
    constructor() {
        this.entities = new Map();
        this.animalIds = new Set();
        this.humanIds = new Set(); 
        this.resourceIds = new Set();
        this.buildingIds = new Set();
        this.nextId = 0;

        // 🚀 [Expert Optimization] TypedArray 기반 컴포넌트 데이터 캐싱 (DOD)
        this.maxEntities = 10000;
        this.transformBuffer = new Float32Array(this.maxEntities * 2); // [x, y]
        this.velocityBuffer = new Float32Array(this.maxEntities * 4);  // [vx, vy, ax, ay]
        
        // 📊 [Expert Design] Stats Buffer Layout (8 slots per entity)
        // 0: hp, 1: maxHp, 2: hunger, 3: maxHunger, 4: fatigue, 5: maxFatigue, 6: strength, 7: defense
        this.statsBuffer = new Int32Array(this.maxEntities * 8); 
        
        // 🌊 [Expert Design] Stats Float Buffer Layout (4 slots per entity)
        // 0: speed, 1: digestionQuality, 2: waste, 3: storedFertility
        this.statsFloatBuffer = new Float32Array(this.maxEntities * 4);

        // 🧠 [Expert Design] State Buffer (Bitmask & Mode)
        // 0: modeIndex, 1: bitmask (1: grabbed, 2: dead, 4: hidden, 8: selected)
        this.stateBuffer = new Int32Array(this.maxEntities * 2);

        // 🎨 [Expert Design] Render Buffer
        // 0: typeIdx, 1: subtypeIdx, 2: frameIdx, 3: flipX, 4: size, 5: alpha(0-255), 6: facing
        this.renderBuffer = new Int32Array(this.maxEntities * 8);

        // 🧬 [Expert Design] Lifecycle Buffer (Alive Flag)
        // 0: isAlive (1 or 0)
        this.aliveBuffer = new Uint8Array(this.maxEntities);

        // 🏷️ [Expert Design] Tag Buffer (Bitmask)
        // 0: tagMask
        this.tagBuffer = new Uint32Array(this.maxEntities);
        
        // ♻️ [Pool] ID 재사용을 위한 큐
        this.freeIds = [];
    }

    createEntity() {
        // ♻️ [Expert Optimization] 풀에서 ID 재사용
        let id;
        if (this.freeIds.length > 0) {
            id = this.freeIds.pop();
        } else {
            id = this.nextId++;
            if (id >= this.maxEntities) {
                this._expandBuffers();
            }
        }

        this.aliveBuffer[id] = 1; // 활성화 플래그 ON

        const entity = {
            id,
            components: new Map()
        };
        this.entities.set(id, entity);
        return id;
    }

    /** 🚀 버퍼 용량 자동 확장 */
    _ensureBufferCapacity(id) {
        if (id < this.maxEntities) return;
        
        const newMax = Math.max(id + 1, Math.floor(this.maxEntities * 1.5));
        console.log(`📏 EntityManager: Expanding buffer capacity to ${newMax}...`);

        const newTransform = new Float32Array(newMax * 2);
        const newVelocity = new Float32Array(newMax * 4);
        const newStats = new Int32Array(newMax * 8);
        const newStatsFloat = new Float32Array(newMax * 4);
        const newState = new Int32Array(newMax * 2);
        const newRender = new Int32Array(newMax * 8);
        const newAlive = new Uint8Array(newMax);
        
        // 기존 데이터 복사 (TypedArray.set은 매우 빠름)
        newTransform.set(this.transformBuffer);
        newVelocity.set(this.velocityBuffer);
        newStats.set(this.statsBuffer);
        newStatsFloat.set(this.statsFloatBuffer);
        newState.set(this.stateBuffer);
        newRender.set(this.renderBuffer);
        newAlive.set(this.aliveBuffer);
        newTag.set(this.tagBuffer);
        
        // 참조 교체
        this.transformBuffer = newTransform;
        this.velocityBuffer = newVelocity;
        this.statsBuffer = newStats;
        this.statsFloatBuffer = newStatsFloat;
        this.stateBuffer = newState;
        this.renderBuffer = newRender;
        this.aliveBuffer = newAlive;
        this.tagBuffer = newTag;
        this.maxEntities = newMax;

        // 🚀 [Critical Fix] 기존 모든 컴포넌트들을 새 버퍼에 재연결 (DOD 동기화)
        // 이 과정에서 컴포넌트 내부의 _buffer 참조가 최신화됩니다.
        this._relinkAllComponents();
    }

    /** 🚀 모든 활성 엔티티의 컴포넌트들을 버퍼에 재연결 */
    _relinkAllComponents() {
        for (const [id, entity] of this.entities) {
            const transform = entity.components.get('Transform');
            const velocity = entity.components.get('Velocity');
            const stats = entity.components.get('BaseStats');

            // 1. Velocity 먼저 연결 (Transform이 Velocity를 참조하므로 순서 중요)
            if (velocity && velocity.linkBuffer) {
                velocity.linkBuffer(this.velocityBuffer, id * 4);
            }

            // 2. Transform 연결 및 Velocity 링크 갱신
            if (transform && transform.linkBuffer) {
                transform.linkBuffer(this.transformBuffer, id * 2);
                if (velocity) {
                    transform.velocity = velocity; // 내부적으로 linkVelocityBuffer 호출함
                }
            }

            // 3. Stats 연결
            if (stats && stats.linkBuffer) {
                stats.linkBuffer(this.statsBuffer, id * 8, this.statsFloatBuffer, id * 4);
            }
            
            // 4. Health 연결 (BaseStats와 동일한 HP 슬롯 공유)
            const health = entity.components.get('Health');
            if (health && health.linkBuffer) {
                health.linkBuffer(this.statsBuffer, id * 8);
            }

            // 5. State & Render 연결
            const aiState = entity.components.get('AIState');
            if (aiState && aiState.linkBuffer) {
                aiState.linkBuffer(this.stateBuffer, id * 2);
            }
            const visual = entity.components.get('Visual');
            if (visual && visual.linkBuffer) {
                visual.linkBuffer(this.renderBuffer, id * 8);
            }
            const tag = entity.components.get('TagBitmask');
            if (tag && tag.linkBuffer) {
                tag.linkBuffer(this.tagBuffer, id);
            }
        }
    }

    removeEntity(id) {
        if (!this.entities.has(id)) return;

        const entity = this.entities.get(id);
        
        // 1. 🧹 [Cleanup] 각 카테고리별 ID 셋에서 제거
        this.animalIds.delete(id);
        this.humanIds.delete(id); // 👤 인간 인덱스 제거
        this.resourceIds.delete(id);
        this.buildingIds.delete(id);

        // 2. 🧬 [Lifecycle] Alive 플래그 OFF 및 버퍼 초기화 (선택 사항)
        this.aliveBuffer[id] = 0;
        
        // 3. ♻️ [Pool] ID 및 컴포넌트 반납
        for (const [name, component] of entity.components) {
            factoryProvider.releaseComponent(name, component);
        }
        entity.components.clear();
        
        this.freeIds.push(id);
        this.entities.delete(id);

        // 4. 📢 이벤트 발행 (DeathProcessor 등이 수신)
        if (this.eventBus) {
            this.eventBus.emit('ENTITY_REMOVED', { id, entity });
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
        this.freeIds = [];
        this.nextId = 0;
        this.aliveBuffer.fill(0);
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
                if (component.linkBuffer) component.linkBuffer(this.transformBuffer, entityId * 2);
                const velocity = entity.components.get('Velocity');
                if (velocity) component.velocity = velocity;
                
                // 🚀 [Expert Design] 정적 개체(건물, 자원)는 공간 해시에 즉시 등록
                if (this.spatialHash && (this.buildingIds.has(entityId) || this.resourceIds.has(entityId))) {
                    this.spatialHash.insert(entityId, component.x, component.y, true);
                }
            } else if (name === 'Velocity') {
                if (component.linkBuffer) component.linkBuffer(this.velocityBuffer, entityId * 4);
                const transform = entity.components.get('Transform');
                if (transform) transform.velocity = component;
            } else if (name === 'BaseStats') {
                if (component.linkBuffer) component.linkBuffer(this.statsBuffer, entityId * 8, this.statsFloatBuffer, entityId * 4);
                // Health 컴포넌트가 있다면 동기화
                const health = entity.components.get('Health');
                if (health && health.linkBuffer) health.linkBuffer(this.statsBuffer, entityId * 8);
            } else if (name === 'Health') {
                if (component.linkBuffer) component.linkBuffer(this.statsBuffer, entityId * 8);
                // BaseStats 컴포넌트가 있다면 동기화
                const stats = entity.components.get('BaseStats');
                if (stats && stats.linkBuffer) stats.linkBuffer(this.statsBuffer, entityId * 8, this.statsFloatBuffer, entityId * 4);
            } else if (name === 'AIState') {
                if (component.linkBuffer) component.linkBuffer(this.stateBuffer, entityId * 2);
            } else if (name === 'Visual') {
                if (component.linkBuffer) component.linkBuffer(this.renderBuffer, entityId * 8);
            } else if (name === 'TagBitmask') {
                if (component.linkBuffer) component.linkBuffer(this.tagBuffer, entityId);
            }

            if (name === 'Animal') {
                this.animalIds.add(entityId);
                if (component.type === 'human') this.humanIds.add(entityId);
            }
            if (name === 'Resource' || name === 'DroppedItem') {
                this.resourceIds.add(entityId);
                const transform = entity.components.get('Transform');
                if (transform && this.spatialHash) {
                    this.spatialHash.insert(entityId, transform.x, transform.y, true);
                }
            }
            if (name === 'Building' || name === 'Structure') {
                this.buildingIds.add(entityId);
                const transform = entity.components.get('Transform');
                if (transform && this.spatialHash) {
                    this.spatialHash.insert(entityId, transform.x, transform.y, true);
                }
            }
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