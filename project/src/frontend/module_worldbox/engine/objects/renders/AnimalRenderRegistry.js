import { SheepRenderer } from './animals/SheepRenderer.js';
import { CowRenderer } from './animals/CowRenderer.js';
import { WolfRenderer } from './animals/WolfRenderer.js';
import { WildDogRenderer } from './animals/WildDogRenderer.js';
import { HyenaRenderer } from './animals/HyenaRenderer.js';
import { HumanRenderer } from './animals/HumanRenderer.js';
import { BeeRenderer } from './animals/BeeRenderer.js';
import { TigerRenderer } from './animals/TigerRenderer.js';
import { LionRenderer } from './animals/LionRenderer.js';
import { BearRenderer } from './animals/BearRenderer.js';
import { FoxRenderer } from './animals/FoxRenderer.js';
import { CrocodileRenderer } from './animals/CrocodileRenderer.js';
import { DeerRenderer } from './animals/DeerRenderer.js';
import { RabbitRenderer } from './animals/RabbitRenderer.js';
import { HorseRenderer } from './animals/HorseRenderer.js';
import { ElephantRenderer } from './animals/ElephantRenderer.js';
import { GoatRenderer } from './animals/GoatRenderer.js';

/**
 * 🦁 AnimalRenderRegistry
 * 동물 종별 렌더링 전략을 관리하는 레지스트리입니다.
 * AnimalRenders.js에서 OCP 준수를 위해 분리되었습니다.
 */
export default class AnimalRenderRegistry {
    constructor() {
        this.strategies = new Map();
        this._initDefaultStrategies();
    }

    _initDefaultStrategies() {
        this.strategies.set('sheep', SheepRenderer);
        this.strategies.set('cow', CowRenderer);
        this.strategies.set('wolf', WolfRenderer);
        this.strategies.set('wild_dog', WildDogRenderer);
        this.strategies.set('hyena', HyenaRenderer);
        this.strategies.set('human', HumanRenderer);
        this.strategies.set('bee', BeeRenderer);
        this.strategies.set('tiger', TigerRenderer);
        this.strategies.set('lion', LionRenderer);
        this.strategies.set('bear', BearRenderer);
        this.strategies.set('fox', FoxRenderer);
        this.strategies.set('crocodile', CrocodileRenderer);
        this.strategies.set('deer', DeerRenderer);
        this.strategies.set('rabbit', RabbitRenderer);
        this.strategies.set('horse', HorseRenderer);
        this.strategies.set('elephant', ElephantRenderer);
        this.strategies.set('goat', GoatRenderer);
    }

    getRenderer(type) {
        return this.strategies.get(type);
    }
}
