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
import LightingSystem from '../systems/render/LightingSystem.js';
import FarmingSystem from '../systems/economy/FarmingSystem.js';
import LivestockSystem from '../systems/lifecycle/LivestockSystem.js';
import EmotionSystem from '../systems/lifecycle/EmotionSystem.js';
import VillageSystem from '../systems/civilization/VillageSystem.js';
import ConstructionSystem from '../systems/civilization/ConstructionSystem.js';
import FenceSystem from '../systems/civilization/FenceSystem.js';
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
        this.fenceSystem = new FenceSystem(em, eb, engine);
        this.zoneManager = new ZoneManager(engine);

        // 🧠 Central Dispatch & Economy
        this.blackboard = new Blackboard();
        this.targetManager = new TargetManager(em, eb, this.blackboard, engine);
        this.economyManager = new EconomyManager(em, eb, this.blackboard);

        // Phase 3: Physics
        this.kinematics = new KinematicSystem(engine);

        // Phase 4: Render Prep
        this.spriteManager = new SpriteManager(em, eb, engine);
        this.lightingSystem = new LightingSystem(em, eb, engine);
        this.particleSystem = new ParticleSystem(em, eb);
        this.godPower = new GodPowerSystem(engine);

        // Phase 5: UI
        this.uiSystem = new UISystem(em, eb, engine);
    }

    _safeUpdate(systemName, updateFn) {
        try {
            updateFn();
        } catch (e) {
            // 🛡️ [Stability] 시스템 오류 발생 시 로깅 후 무시하여 메인 루프 보존
            if (!this._lastErrors) this._lastErrors = new Map();
            const now = Date.now();
            const lastErrorTime = this._lastErrors.get(systemName) || 0;
            
            if (now - lastErrorTime > 5000) { // 5초에 한 번만 에러 출력 (스팸 방지)
                console.error(`❌ [SystemManager] Error in ${systemName}:`, e);
                this._lastErrors.set(systemName, now);
            }
        }
    }

    update(dt, time) {
        if (!this.engine) return;
        const frameCount = this.engine.frameCount || 0;
        const monitor = this.engine.monitor;

        const startTotal = performance.now();

        // [Phase 1] 환경 및 입력
        this._safeUpdate('Environment', () => {
            const t1 = performance.now();
            this.wind.update(time);
            this.environment.update(dt, time);
            if (monitor) monitor.setSystemTiming('Environment', performance.now() - t1);
        });

        // [Phase 2] AI & Logic
        this._safeUpdate('AI_Logic', () => {
            const t2 = performance.now();
            this.combat.update(dt, time);
            this.deathProcessor.update(dt, time);
            this.humanBehavior.update(dt, time);
            this.behavior.update(dt, time);

            if (frameCount % 3 === 0) this.herding.update(dt * 3);

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
                this.fenceSystem.update(dt5);
                this.spawner.update(dt5, time);
                this.zoneManager.update(dt5);
            }
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
            if (frameCount % 15 === 12) {
                this.targetManager.update(dt * 15);
                this.economyManager.update(dt * 15);
            }
            if (monitor) monitor.setSystemTiming('AI_Combat_Civ', performance.now() - t2);
        });

        // [Phase 3] 물리 연산
        this._safeUpdate('Kinematics', () => {
            const t3 = performance.now();
            this.kinematics.update(dt);
            if (monitor) monitor.setSystemTiming('Kinematics', performance.now() - t3);
        });

        // [Phase 4] 시각적 표현 & UI
        this._safeUpdate('Visual_UI', () => {
            const t4 = performance.now();
            this.spriteManager.update(dt, time);
            this.lightingSystem.update(dt, time);
            this.particleSystem.update(dt, time);
            this.godPower.update(dt);
            this.uiSystem.update(dt, time);
            if (monitor) monitor.setSystemTiming('Visual_UI', performance.now() - t4);
        });

        if (monitor) monitor.setSystemTiming('Total_Update', performance.now() - startTotal);
    }

    destroy() {
        // 모든 시스템의 destroy() 호출 및 참조 제거
        Object.keys(this).forEach(key => {
            if (key === 'engine' || key === 'spatialHash') return; // 순환 호출 방지
            
            const system = this[key];
            if (system && typeof system.destroy === 'function') {
                system.destroy();
            }
            this[key] = null;
        });
        this.engine = null;
    }
}