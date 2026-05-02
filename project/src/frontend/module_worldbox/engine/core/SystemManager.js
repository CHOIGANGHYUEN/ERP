import AnimalBehaviorSystem from '../systems/behavior/AnimalBehaviorSystem.js';
import HumanBehaviorSystem from '../systems/behavior/HumanBehaviorSystem.js';
// 🚀 Cache Refresh Trigger
import SpatialHash from '../utils/SpatialHash.js';
import CombatSystem from '../systems/behavior/CombatSystem.js';
import DeathProcessor from '../systems/behavior/DeathProcessor.js';
import SocialSystem from '../systems/motion/SocialSystem.js';
import GatheringSystem from '../systems/economy/GatheringSystem.js';
import ConsumptionSystem from '../systems/economy/ConsumptionSystem.js';
import KinematicSystem from '../systems/motion/KinematicSystem.js';
import MetabolismSystem from '../systems/lifecycle/MetabolismSystem.js';
import ReproductionSystem from '../systems/lifecycle/ReproductionSystem.js';
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

        // Phase 1: Environment & Input
        this.inputSystem = new InputSystem(em, eb, engine);
        this.wind = new WindSystem();
        this.environment = new EnvironmentSystem(em, eb, engine);

        // Phase 2: Logic & AI
        this.humanBehavior = new HumanBehaviorSystem(em, eb, engine, this.spatialHash);
        this.behavior = new AnimalBehaviorSystem(em, eb, engine, this.spatialHash);
        this.combat = new CombatSystem(em, eb, engine);
        this.deathProcessor = new DeathProcessor(em, eb, engine);
        this.social = new SocialSystem(engine);
        this.gathering = new GatheringSystem(em, eb, engine);
        this.consumption = new ConsumptionSystem(em, eb, engine);
        this.metabolism = new MetabolismSystem(em, eb, tg);
        this.reproduction = new ReproductionSystem(em, eb, engine);
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

        // Phase 4: Render Prep
        this.spriteManager = new SpriteManager(em, eb);
        this.particleSystem = new ParticleSystem(em, eb);
        this.cullingSystem = new CullingSystem(em, eb, engine);

        // Phase 5: UI
        this.uiSystem = new UISystem(em, eb, engine);
    }

    update(dt, time) {
        // [Phase 1] 환경 및 입력 업데이트 (Polling)
        this.wind.update(time);
        this.environment.update(dt, time);

        // [Phase 2] 물리 이동 전 객체 상태 및 AI 판단 (AI & Logic)
        this.combat.update(dt, time); // Event-driven (대기)
        this.deathProcessor.update(dt, time);
        this.humanBehavior.update(dt, time);
        this.behavior.update(dt, time);
        this.social.update(dt);
        this.gathering.update(dt, time);
        this.consumption.update(dt);
        this.metabolism.update(dt, time);
        this.reproduction.update(dt, time);
        this.spawner.update(dt, time);
        this.farming.update(dt, time);
        this.livestock.update(dt, time);
        this.emotion.update(dt, time);
        this.villageSystem.update(dt, time);
        this.construction.update(dt, time);

        // [Phase 2.5] 중앙 관제 및 경제 업데이트 (Low Frequency)
        this.targetManager.update(dt);
        this.economyManager.update(dt);

        // [Phase 3] 이동 및 물리 연산 반영 (Kinematics)
        this.kinematics.update(dt);

        // [Phase 4] 시각적 표현 및 렌더링 최적화 준비 (Post-Physics)
        this.cullingSystem.update(dt, time);
        this.spriteManager.update(dt, time);
        this.particleSystem.update(dt, time);

        // [Phase 5] UI 및 오버레이 처리
        this.uiSystem.update(dt, time);
    }

    destroy() {
        if (this.particleSystem && typeof this.particleSystem.destroy === 'function') {
            this.particleSystem.destroy();
        }
    }
}