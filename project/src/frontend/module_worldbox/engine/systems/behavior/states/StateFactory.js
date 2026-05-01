import WanderState from './WanderState.js';
import HuntState from './HuntState.js';
import ForageState from './ForageState.js';
import EatState from './EatState.js';
import SleepState from './SleepState.js';
import FleeState from './FleeState.js';
import GatherWoodState from './GatherWoodState.js';
import BuildState from './BuildState.js';
import { AnimalStates } from '../../../components/behavior/State.js';

export default class StateFactory {
    constructor(system) {
        this.system = system;
        this.states = new Map();

        // 의존성 역전(DIP): 시스템은 구체적인 State 클래스를 모르고, Factory가 상태를 주입함
        this.states.set(AnimalStates.IDLE, new WanderState(system));
        this.states.set(AnimalStates.WALK, this.states.get(AnimalStates.IDLE)); // 기본 Wander 로직 재사용
        this.states.set(AnimalStates.RUN, this.states.get(AnimalStates.IDLE));
        this.states.set(AnimalStates.HUNT, new HuntState(system));
        this.states.set(AnimalStates.FORAGE, new ForageState(system));
        this.states.set(AnimalStates.EAT, new EatState(system));
        this.states.set(AnimalStates.SLEEP, new SleepState(system));
        this.states.set(AnimalStates.FLEE, new FleeState(system));
        this.states.set(AnimalStates.EVADE, this.states.get(AnimalStates.FLEE));
        this.states.set('gather_wood', new GatherWoodState(system));
        this.states.set('build', new BuildState(system));
    }

    getState(modeName) {
        return this.states.get(modeName) || this.states.get(AnimalStates.IDLE);
    }
}