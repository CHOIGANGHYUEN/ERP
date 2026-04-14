export class PluginManager {
  constructor() {
    this.plugins = new Map()

    // 확장 가능한 데이터 및 로직 레지스트리 (Registries)
    this.registries = {
      jobs: new Map(),
      animalTypes: new Map(),
      plantTypes: new Map(),
      buildingTypes: new Map(),
      actions: new Map(),
      renders: new Map(),
    }
  }

  /**
   * 플러그인을 시스템에 설치합니다.
   * @param {Object} plugin - name 속성과 install(pluginManager) 메서드를 가진 객체
   */
  install(plugin) {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginManager] Plugin '${plugin.name}' is already installed.`)
      return
    }

    plugin.install(this)
    this.plugins.set(plugin.name, plugin)
    console.log(`[PluginManager] Successfully installed plugin: ${plugin.name}`)
  }

  // --- 레지스트리 등록 및 조회 유틸리티 ---

  registerJob(jobId, jobDefinition) {
    this.registries.jobs.set(jobId, jobDefinition)
  }
  getJob(jobId) {
    return this.registries.jobs.get(jobId)
  }

  registerAnimalType(typeId, definition) {
    this.registries.animalTypes.set(typeId, definition)
  }
  getAnimalType(typeId) {
    return this.registries.animalTypes.get(typeId)
  }

  registerBuildingType(typeId, definition) {
    this.registries.buildingTypes.set(typeId, definition)
  }
  getBuildingType(typeId) {
    return this.registries.buildingTypes.get(typeId)
  }

  // 필요 시 추가적인 register 및 get 메서드 확장 가능
}
