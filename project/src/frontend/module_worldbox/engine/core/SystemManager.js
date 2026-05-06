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
import Blackboard from '../systems/behavior/Blackboard.js';
import TargetManager from '../systems/behavior/TargetManager.js';
import EconomyManager from '../systems/economy/EconomyManager.js';
import GodPowerSystem from '../systems/god/GodPowerSystem.js';

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

        // Phase 1: Environment & Input
        this.inputSystem = new InputSystem(em, eb, engine);
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
        this.targetManager = new TargetManager(em, eb, this.blackboard, engine);
        this.economyManager = new EconomyManager(em, eb, this.blackboard);

        // Phase 3: Physics
        this.kinematics = new KinematicSystem(engine);

        // Phase 4: Render Prep
        this.spriteManager = new SpriteManager(em, eb);
        this.particleSystem = new ParticleSystem(em, eb);
        this.godPower = new GodPowerSystem(engine);

        // Phase 5: UI
        this.uiSystem = new UISystem(em, eb, engine);
    }

    update(dt, time) {
        const frameCount = this.engine.frameCount || 0;

        // [Phase 1] 환경 및 입력 업데이트 (Critical - 60Hz)
        this.wind.update(time);
        this.environment.update(dt, time);

        // [Phase 2] AI & Logic (Throttled)
        
        // ⚔️ Combat & Death (Critical - 60Hz to prevent missed events)
        this.combat.update(dt, time);
        this.deathProcessor.update(dt, time);

        // 🧠 AI Behavior (60Hz - Synchronized with Kinematics to remove inertia)
        this.humanBehavior.update(dt, time);
        this.behavior.update(dt, time);

        // 🐕 Herding & Motion Logic (20Hz)
        if (frameCount % 3 === 0) {
            this.herding.update(dt * 3);
        }

        // 🏘️ Civilization & Economy (12Hz) - Staggered
        if (frameCount % 5 === 0) {
            const dt5 = dt * 5;
            this.social.update(dt5, time);
            this.nationSystem.update(dt5, time);
            this.gathering.update(dt5, time);
            this.consumption.update(dt5);
        }
        if (frameCount % 5 === 2) {
            const dt5 = dt * 5;
            this.farming.update(dt5, time);
            this.livestock.update(dt5, time);
            this.villageSystem.update(dt5, time);
            this.construction.update(dt5, time);
            this.spawner.update(dt5, time);
        }

        // 🧪 Lifecycle & Stats (6Hz) - Staggered
        if (frameCount % 10 === 5) {
            const dt10 = dt * 10;
            this.metabolism.update(dt10, time);
            this.reproduction.update(dt10, time);
        }
        if (frameCount % 10 === 8) {
            const dt10 = dt * 10;
            this.health.update(dt10, time);
            this.emotion.update(dt10, time);
        }

        // [Phase 2.5] 중앙 관제 (Low Frequency - 4Hz)
        if (frameCount % 15 === 12) {
            this.targetManager.update(dt * 15);
            this.economyManager.update(dt * 15);
        }

        // [Phase 3] 이동 및 물리 연산 반영 (Critical - 60Hz)
        this.kinematics.update(dt);

        // [Phase 4] 시각적 표현 (Critical - 60Hz)
        this.spriteManager.update(dt, time);
        this.particleSystem.update(dt, time);
        this.godPower.update(dt);

        // [Phase 5] UI (Critical - 60Hz)
        this.uiSystem.update(dt, time);
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