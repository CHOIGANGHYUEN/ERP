import WanderState from './WanderState.js';
import IdleState from './IdleState.js';
import HuntState from './HuntState.js';
import ForageState from './ForageState.js';
import EatState from './EatState.js';
import SleepState from './SleepState.js';
import FleeState from './FleeState.js';
import GatherWoodState from './GatherWoodState.js';
import GatherStoneState from './GatherStoneState.js';
import GatherPlantState from './GatherPlantState.js';
import BuildState from './BuildState.js';
import DepositState from './DepositState.js';
import LumberjackState from './jobs/LumberjackState.js';
import WaitForTargetState from './WaitForTargetState.js';
import TransporterState from './jobs/TransporterState.js';
import FarmerState from './jobs/FarmerState.js';
import MinerState from './jobs/MinerState.js';
import SoldierState from './jobs/SoldierState.js';
import GrazeState from './GrazeState.js';
import GrabbedState from './GrabbedState.js';
import PickupState from './PickupState.js';
import WithdrawState from './WithdrawState.js';
import ChiefSurveyState from './roles/ChiefSurveyState.js';
import ChiefExpandState from './roles/ChiefExpandState.js';
import ChiefInspectState from './roles/ChiefInspectState.js';
import ChiefPatrolState from './roles/ChiefPatrolState.js';
import EmergencyWorkingState from './roles/EmergencyWorkingState.js';
import ChiefSpeechState from './roles/ChiefSpeechState.js';
import ChiefDispatchState from './roles/ChiefDispatchState.js';
import { AnimalStates } from '../../../components/behavior/State.js';

export default class StateFactory {
    constructor(system) {
        this.system = system;
        this.states = new Map();

        // 의존성 역전(DIP): 시스템은 구체적인 State 클래스를 모르고, Factory가 상태를 주입함
        this.states.set(AnimalStates.IDLE, new IdleState(system));
        this.states.set(AnimalStates.WANDER, new WanderState(system));
        this.states.set(AnimalStates.RUN, this.states.get(AnimalStates.WANDER));
        this.states.set(AnimalStates.HUNT, new HuntState(system));
        this.states.set(AnimalStates.FORAGE, new ForageState(system));
        this.states.set(AnimalStates.EAT, new EatState(system));
        this.states.set(AnimalStates.GRAZE, new GrazeState(system));
        this.states.set(AnimalStates.SLEEP, new SleepState(system));
        this.states.set(AnimalStates.FLEE, new FleeState(system));
        this.states.set(AnimalStates.EVADE, this.states.get(AnimalStates.FLEE));
        this.states.set(AnimalStates.PICKUP, new PickupState(system));
        this.states.set('gather_wood', new GatherWoodState(system));
        this.states.set('gather_stone', new GatherStoneState(system));
        this.states.set('gather_plant', new GatherPlantState(system));
        this.states.set('build', new BuildState(system));
        this.states.set('deposit', new DepositState(system));
        this.states.set('withdraw', new WithdrawState(system));

        // 🏷️ Job States — 키 규칙: `job_${JobTypes.XXX}`
        // 🧱 [Crucial Fix] 'architect' 직업 키가 누락되어 건축가들이 동작하지 않던 문제 해결
        this.states.set('job_architect', this.states.get('build'));
        this.states.set('job_logger', new LumberjackState(system));
        this.states.set('job_gatherer', new GatherPlantState(system));
        this.states.set('job_farmer', new FarmerState(system));
        this.states.set('job_miner', new MinerState(system));
        this.states.set('job_soldier', new SoldierState(system));
        this.states.set('job_warrior', this.states.get('job_soldier')); // Alias
        
        this.states.set('job_transporter', new TransporterState(system));
        this.states.set('wait_target', new WaitForTargetState(system));
        this.states.set('chief_survey', new ChiefSurveyState(system));
        this.states.set('chief_expand', new ChiefExpandState(system));
        this.states.set('chief_inspect', new ChiefInspectState(system));
        this.states.set('chief_patrol', new ChiefPatrolState(system));
        this.states.set('chief_emergency', new EmergencyWorkingState(system));
        this.states.set('chief_speech', new ChiefSpeechState(system));
        this.states.set('chief_dispatch', new ChiefDispatchState(system));
        this.states.set(AnimalStates.GRABBED, new GrabbedState(system));
    }

    getState(modeName) {
        return this.states.get(modeName) || this.states.get(AnimalStates.IDLE);
    }
}
