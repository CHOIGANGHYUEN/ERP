import AnimalBehaviorSystem from '../systems/behavior/AnimalBehaviorSystem.js';
import HumanBehaviorSystem from '../systems/behavior/HumanBehaviorSystem.js';
// 🚀 Cache Refresh Trigger
import SpatialHash from '../utils/SpatialHash.js';
import CombatSystem from '../systems/behavior/CombatSystem.js';
import DeathProcessor from '../systems/behavior/DeathProcessor.js';
import HerdingSystem from '../systems/motion/HerdingSystem.js';
import SocialSystem from '../systems/civilization/SocialSystem.js';
import NationSystem from '../systems/civilization/NationSystem.js';
import GatheringSystem from '../systems/economy/GatheringSystem.js';
import ConsumptionSystem from '../systems/economy/ConsumptionSystem.js';
import KinematicSystem from '../systems/motion/KinematicSystem.js';
import MetabolismSystem from '../systems/lifecycle/MetabolismSystem.js';
import ReproductionSystem from '../systems/lifecycle/ReproductionSystem.js';
import HealthSystem from '../systems/lifecycle/HealthSystem.js';
import SpriteManager from '../systems/render/SpriteManager.js';
import EnvironmentSystem from '../systems/lifecycle/EnvironmentSystem.js';
import SpawnerSystem from '../systems/economy/SpawnerSystem.js';
import WindSystem from '../systems/lifecycle/WindSystem.js';
import InputSystem from '../systems/input/InputSystem.js';
import UISystem from './UISystem.js';
import ParticleSystem from '../systems/render/ParticleSystem.js';
import FarmingSystem from '../systems/economy/FarmingSystem.js';
import LivestockSystem from '../systems/lifecycle/LivestockSystem.js';
import EmotionSystem from '../systems/lifecycle/EmotionSystem.js';
import VillageSystem from '../systems/civilization/VillageSystem.js';
import ConstructionSystem from '../systems/civilization/ConstructionSystem.js';
import ZoneManager from '../systems/civilization/ZoneManager.js';
import CullingSystem from '../systems/render/CullingSystem.js';
import Blackboard from '../systems/behavior/Blackboard.js';
import TargetManager from '../systems/behavior/TargetManager.js';
import EconomyManager from '../systems/economy/EconomyManager.js';

export default class SystemManager {
    constructor(engine) {
        this.engine = engine;
        const em = engine.entityManager;
        const eb = engine.eventBus;
        const tg = engine.terrainGen;
        
        // 🚀 SHARED SPATIAL HASH: AI와 Renderer가 공통으로 사용하여 Culling 성능 극대화
        this.spatialHash = new SpatialHash(100);
        engine.spatialHash = this.spatialHash;
        engine.entityManager.spatialHash = this.spatialHash;

        const isWorker = typeof window === 'undefined';

        // Phase 1: Environment & Input
        this.inputSystem = !isWorker ? new InputSystem(em, eb, engine) : null;
        this.wind = new WindSystem();
        this.environment = new EnvironmentSystem(em, eb, engine);

        // Phase 2: Logic & AI
        this.humanBehavior = new HumanBehaviorSystem(em, eb, engine, this.spatialHash);
        this.behavior = new AnimalBehaviorSystem(em, eb, engine, this.spatialHash);
        this.combat = new CombatSystem(em, eb, engine);
        this.deathProcessor = new DeathProcessor(em, eb, engine);
        this.herding = new HerdingSystem(engine);
        this.social = new SocialSystem(em, eb, engine);
        this.nationSystem = new NationSystem(em, eb, engine);
        this.gathering = new GatheringSystem(em, eb, engine);
        this.consumption = new ConsumptionSystem(em, eb, engine);
        this.metabolism = new MetabolismSystem(em, eb, engine, tg);
        this.reproduction = new ReproductionSystem(em, eb, engine);
        this.health = new HealthSystem(em, eb);
        this.spawner = new SpawnerSystem(em, eb, engine);
        
        // 🌾 Economy & Lifecycle Expansion
        this.farming = new FarmingSystem(em, eb, engine);
        this.livestock = new LivestockSystem(em, eb, engine);
        this.emotion = new EmotionSystem(em, eb);
        this.villageSystem = new VillageSystem(em, eb, engine);
        this.construction = new ConstructionSystem(em, eb, engine);
        this.zoneManager = new ZoneManager(engine);

        // 🧠 Central Dispatch & Economy
        this.blackboard = new Blackboard();
        this.targetManager = new TargetManager(em, eb, this.blackboard);
        this.economyManager = new EconomyManager(em, eb, this.blackboard);

        // Phase 3: Physics
        this.kinematics = new KinematicSystem(engine);

        // Phase 4: Render Prep (Main Thread Only)
        this.spriteManager = !isWorker ? new SpriteManager(em, eb) : null;
        this.particleSystem = !isWorker ? new ParticleSystem(em, eb) : null;
        this.cullingSystem = !isWorker ? new CullingSystem(em, eb, engine) : null;

        // Phase 5: UI (Main Thread Only)
        this.uiSystem = !isWorker ? new UISystem(em, eb, engine) : null;
    }

    update(dt, time) {
        const isWorker = typeof window === 'undefined';

        // 🚀 [Expert Optimization] 프레임 시작 시 동적 해시 초기화
        if (this.spatialHash) this.spatialHash.clearDynamic();

        // [Common] 환경 및 입력 업데이트
        if (this.inputSystem) this.inputSystem.update(dt);
        this.wind.update(time);
        this.environment.update(dt, time);

        if (isWorker) {
            // --- ⚙️ WORKER THREAD ONLY: Logic & Physics ---
            
            // [Phase 2] AI & Logic
            this.combat.update(dt, time);
            this.deathProcessor.update(dt, time);
            this.humanBehavior.update(dt, time);
            this.behavior.update(dt, time);
            this.herding.update(dt);
            this.social.update(dt, time);
            this.nationSystem.update(dt, time);
            this.gathering.update(dt, time);
            this.consumption.update(dt);
            this.metabolism.update(dt, time);
            this.reproduction.update(dt, time);
            this.health.update(dt, time);
            this.spawner.update(dt, time);
            this.farming.update(dt, time);
            this.livestock.update(dt, time);
            this.emotion.update(dt, time);
            this.villageSystem.update(dt, time);
            this.construction.update(dt, time);

            // [Phase 2.5] 중앙 관제
            this.targetManager.update(dt);
            this.economyManager.update(dt);

            // [Phase 3] Physics
            this.kinematics.update(dt);
        } else {
            // --- 🎨 MAIN THREAD ONLY: Rendering & UI ---
            
            // 🚀 [Critical] 메인 스레드에서도 SpatialHash는 최신 상태로 유지되어야 함 (Rendering Culling용)
            // KinematicSystem의 일부 로직(LOD 체크 및 Hash 삽입)을 메인 스레드용으로 제한적으로 실행하거나 
            // 아예 메인 전용 Hash 삽입 로직을 추가
            this.updateMainThreadSpatialHash();

            if (this.cullingSystem) this.cullingSystem.update(dt, time);
            if (this.spriteManager) this.spriteManager.update(dt, time);
            if (this.particleSystem) this.particleSystem.update(dt, time);
            if (this.uiSystem) this.uiSystem.update(dt, time);
        }
    }

    /**
     * 🛰️ 메인 스레드용 고속 공간 해시 업데이트
     * 렌더러가 가시 영역 엔티티를 찾을 수 있도록 프록시 엔티티들의 위치를 해시에 삽입합니다.
     */
    updateMainThreadSpatialHash() {
        const em = this.engine.entityManager;
        for (const [id, entity] of em.entities) {
            const transform = entity.components.get('Transform');
            if (transform) {
                this.spatialHash.insert(id, transform.x, transform.y, false);
            }
        }
    }

    destroy() {
        // 모든 시스템의 destroy() 호출 및 참조 제거
        Object.keys(this).forEach(key => {
            const system = this[key];
            if (system && typeof system.destroy === 'function') {
                system.destroy();
            }
            this[key] = null;
        });
    }
}