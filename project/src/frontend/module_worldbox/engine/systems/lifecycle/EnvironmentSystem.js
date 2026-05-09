import System from '../../core/System.js';

export const WeatherTypes = {
    CLEAR: 0,
    RAIN: 1,
    SNOW: 2,
    STORM: 3
};

/**
 * 🌍 EnvironmentSystem (환경 시스템)
 * 날씨 변화(비, 눈 등) 상태를 관리하고 파티클 생성을 트리거합니다.
 */
export default class EnvironmentSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        
        this.currentWeather = WeatherTypes.CLEAR;
        this.weatherTimer = 0;
        this.weatherDuration = 30000; // 30초마다 날씨 변경 확률 (데모용)
    }

    update(dt, time) {
        this.weatherTimer += dt * 1000;
        
        // 1. 날씨 변경 로직
        if (this.weatherTimer >= this.weatherDuration) {
            this.weatherTimer = 0;
            this.changeWeather();
        }

        // 2. 날씨 파티클 스폰 (매 프레임)
        this.spawnWeatherParticles();
    }

    changeWeather() {
        const rand = Math.random();
        if (rand < 0.6) {
            this.currentWeather = WeatherTypes.CLEAR;
            if (this.engine.wind) this.engine.wind.baseSpeed = 0.5;
        } else if (rand < 0.8) {
            this.currentWeather = WeatherTypes.RAIN;
            if (this.engine.wind) this.engine.wind.baseSpeed = 1.2;
        } else if (rand < 0.9) {
            this.currentWeather = WeatherTypes.SNOW;
            if (this.engine.wind) this.engine.wind.baseSpeed = 0.8;
        } else {
            this.currentWeather = WeatherTypes.STORM;
            if (this.engine.wind) this.engine.wind.baseSpeed = 3.0;
        }
        
        // 날씨 변경 알림 (UI 등에 사용)
        this.eventBus.emit('WEATHER_CHANGED', { weather: this.currentWeather });
    }

    spawnWeatherParticles() {
        if (this.currentWeather === WeatherTypes.CLEAR) return;

        const ps = this.engine.systemManager?.particleSystem;
        const camera = this.engine.camera;
        if (!ps || !camera) return;

        // 카메라가 보는 화면 영역 내에서 파티클 무작위 스폰
        const canvasW = this.engine.width / camera.zoom;
        const canvasH = this.engine.height / camera.zoom;
        
        // 매 프레임 날씨에 따라 스폰 개수 조절
        let count = 0;
        if (this.currentWeather === WeatherTypes.RAIN) count = 5;
        else if (this.currentWeather === WeatherTypes.SNOW) count = 3;
        else if (this.currentWeather === WeatherTypes.STORM) count = 10;

        for (let i = 0; i < count; i++) {
            const x = camera.x + Math.random() * canvasW;
            const y = camera.y - 100; // 화면 위쪽에서 시작

            if (this.currentWeather === WeatherTypes.RAIN || this.currentWeather === WeatherTypes.STORM) {
                ps.spawn('RAINDROP', { x, y, velocity: { x: 1, y: 15 + Math.random() * 5 }, color: 'rgba(150, 200, 255, 0.6)', size: 1, life: 1.5 });
            } else if (this.currentWeather === WeatherTypes.SNOW) {
                ps.spawn('SNOWFLAKE', { x, y, velocity: { x: (Math.random() - 0.5) * 2, y: 2 + Math.random() * 2 }, color: 'rgba(255, 255, 255, 0.8)', size: 2, life: 2.5 });
            }
        }
    }
}