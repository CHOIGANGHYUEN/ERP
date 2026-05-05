import AnimalBehaviorSystem from '../systems/behavior/AnimalBehaviorSystem.js';
import HumanBehaviorSystem from '../systems/behavior/HumanBehaviorSystem.js';
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

/**
 * 🚀 [Performance Overhaul] SystemManager
 * 이제 모드(MAIN/WORKER)에 따라 필요한 시스템만 선별적으로 초기화합니다.
 */
export default class SystemManager {
    constructor(engine, mode = 'MAIN') {
        this.engine = engine;
        this.mode = mode;
        const em = engine.entityManager;
        const eb = engine.eventBus;
        const tg = engine.terrainGen;
        
        this.spatialHash = engine.spatialHash || new SpatialHash(100);
        engine.spatialHash = this.spatialHash;

        if (mode === 'MAIN') {
            this._initMainSystems(em, eb, engine);
        } else {
            this._initWorkerSystems(em, eb, engine, tg);
        }
    }

    _initMainSystems(em, eb, engine) {
        // [MAIN] 렌더링 및 사용자 입력 전용 시스템
        this.inputSystem = new InputSystem(em, eb, engine);
        this.wind = new WindSystem(); // 🚀 추가 (렌더링 흔들림용)
        this.spriteManager = new SpriteManager(em, eb);
        this.particleSystem = new ParticleSystem(em, eb);
        this.cullingSystem = new CullingSystem(em, eb, engine);
        this.uiSystem = new UISystem(em, eb, engine);
    }

    _initWorkerSystems(em, eb, engine, tg) {
        // [WORKER] 시뮬레이션 및 AI 전용 시스템
        this.wind = new WindSystem();
        this.environment = new EnvironmentSystem(em, eb, engine);
        
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
        
        this.farming = new FarmingSystem(em, eb, engine);
        this.livestock = new LivestockSystem(em, eb, engine);
        this.emotion = new EmotionSystem(em, eb);
        this.villageSystem = new VillageSystem(em, eb, engine);
        this.construction = new ConstructionSystem(em, eb, engine);
        this.zoneManager = new ZoneManager(engine);

        this.blackboard = new Blackboard();
        this.targetManager = new TargetManager(em, eb, this.blackboard);
        this.economyManager = new EconomyManager(em, eb, this.blackboard);

        this.kinematics = new KinematicSystem(engine);
    }

    update(dt, time) {
        if (this.mode === 'MAIN') {
            this._updateMain(dt, time);
        } else {
            this._updateWorker(dt, time);
        }
    }

    _updateMain(dt, time) {
        // 메인 스레드 업데이트 (Input -> Render Prep -> UI)
        if (this.inputSystem) this.inputSystem.update(dt, time);
        if (this.wind) this.wind.update(time);
        if (this.cullingSystem) this.cullingSystem.update(dt, time);
        if (this.spriteManager) this.spriteManager.update(dt, time);
        if (this.particleSystem) this.particleSystem.update(dt, time);
        if (this.uiSystem) this.uiSystem.update(dt, time);
    }

    _updateWorker(dt, time) {
        // 워커 스레드 업데이트 (Environment -> AI -> Physics)
        if (this.spatialHash) this.spatialHash.clearDynamic();

        if (this.wind) this.wind.update(time);
        if (this.environment) this.environment.update(dt, time);

        if (this.deathProcessor) this.deathProcessor.update(dt, time);
        if (this.humanBehavior) this.humanBehavior.update(dt, time);
        if (this.behavior) this.behavior.update(dt, time);
        if (this.herding) this.herding.update(dt);
        if (this.social) this.social.update(dt, time);
        if (this.nationSystem) this.nationSystem.update(dt, time);
        if (this.gathering) this.gathering.update(dt, time);
        if (this.consumption) this.consumption.update(dt);
        if (this.metabolism) this.metabolism.update(dt, time);
        if (this.reproduction) this.reproduction.update(dt, time);
        if (this.health) this.health.update(dt, time);
        if (this.spawner) this.spawner.update(dt, time);
        if (this.farming) this.farming.update(dt, time);
        if (this.livestock) this.livestock.update(dt, time);
        if (this.emotion) this.emotion.update(dt, time);
        if (this.villageSystem) this.villageSystem.update(dt, time);
        if (this.construction) this.construction.update(dt, time);

        if (this.targetManager) this.targetManager.update(dt);
        if (this.economyManager) this.economyManager.update(dt);

        if (this.kinematics) this.kinematics.update(dt);
    }

    destroy() {
        Object.keys(this).forEach(key => {
            const system = this[key];
            if (system && typeof system.destroy === 'function') {
                system.destroy();
            }
            if (key !== 'engine') this[key] = null;
        });
    }
}