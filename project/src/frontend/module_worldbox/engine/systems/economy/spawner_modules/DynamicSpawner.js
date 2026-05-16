/**
 * 🌿 DynamicSpawner
 * 인게임 루프에서 주기적으로 호출되는 자원 증식 및 동적 스폰 제어를 담당합니다.
 * SpawnerSystem.js에서 SRP에 따라 분리되었습니다.
 */
export default class DynamicSpawner {
    constructor(spawnerSystem) {
        this.ss = spawnerSystem;
        this.terrainGen = spawnerSystem.terrainGen;
    }

    autoSpawnResources() {
        // 🚀 [Stability Guard] 지형 준비 여부 체크
        if (!this.terrainGen || this.terrainGen.mapWidth === 0 || !this.terrainGen.biomeBuffer) return;

        const BATCH_SIZE = 15;
        for (let i = 0; i < BATCH_SIZE; i++) {
            const x = Math.floor(Math.random() * this.terrainGen.mapWidth);
            const y = Math.floor(Math.random() * this.terrainGen.mapHeight);
            const idx = this.terrainGen.getIndex(x, y);
            if (idx === -1) continue;

            const biomeId = this.terrainGen.biomeBuffer[idx];
            const fertility = this.terrainGen.fertilityBuffer[idx] / 100;

            if (fertility < 0.2) continue;

            const possibleResources = this.ss.biomeSpawnTable.get(biomeId);
            if (!possibleResources || possibleResources.length === 0) continue;

            if (Math.random() < fertility * 0.05) {
                const resourceId = possibleResources[Math.floor(Math.random() * possibleResources.length)];
                this.ss.assembler.spawnGenericResource(x, y, resourceId, false);
            }
        }
    }

    spawnPoop(x, y, fertilityAmount = 1.0) {
        this.ss.engine.factoryProvider.spawn('item', 'poop', x, y, { quality: fertilityAmount });
    }
}
