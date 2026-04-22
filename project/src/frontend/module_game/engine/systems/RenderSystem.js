import { Creature } from '../objects/life/Creature.js'
import { Plant } from '../objects/life/Plant.js'
import { Resource } from '../objects/environment/Resource.js'
import { Animal } from '../objects/life/Animal.js'
import { Building } from '../objects/society/Building.js'
import { Tornado } from '../objects/environment/Tornado.js'
import { Mine } from '../objects/environment/Mine.js'
import { Village } from '../objects/society/Village.js'
import { PROPS, STRIDE } from '../core/SharedState.js'

export class RenderSystem {
  constructor() {
    // 렌더링용 플라이웨이트 껍데기 객체 (GC 최소화)
    this.renderProxies = {
      creature: Object.create(Creature.prototype),
      plant: Object.create(Plant.prototype),
      animal: Object.create(Animal.prototype),
      building: Object.create(Building.prototype),
      village: Object.create(Village.prototype),
      tornado: Object.create(Tornado.prototype),
      resource: Object.create(Resource.prototype),
      mine: Object.create(Mine.prototype),
    }

    // [Performance Optimization] 프레임당 가비지 생성을 방지하기 위한 정적 버킷 및 풀 (Zero-GC)
    this.buckets = new Map() // [Hardening] 맵(Map)을 사용하여 안정적 인덱싱 및 빠른 비우기 지원
    this.arrayPool = []
    this.poolIdx = 0
  }

  // 풀에서 배열을 꺼내고, 필요 시 새로 생성
  _getArrayFromPool() {
    if (this.poolIdx < this.arrayPool.length) {
      const arr = this.arrayPool[this.poolIdx++]
      arr.length = 0 // 기존 내용 비움
      return arr
    }
    const newArr = []
    this.arrayPool.push(newArr)
    this.poolIdx++
    return newArr
  }

  render(world, timestamp) {
    if (world.isHeadless || !world.views) return

    try {
      world.ctx.clearRect(0, 0, world.canvas.width, world.canvas.height)
      world.ctx.imageSmoothingEnabled = false
      world.ctx.save()

      const zoom = world.camera.zoom || 1
      world.ctx.scale(zoom, zoom)
      world.ctx.translate(-world.camera.x, -world.camera.y)
      world.disasterSystem.applyCameraShake(world.ctx)

      // ── 0. 정적 지형 레이어 업데이트 (수만 개의 타일 사전 렌더링) ─────────────────
      if (world.needsStaticTerrainUpdate && world.terrain) {
        const sCtx = world.bgStaticCtx
        sCtx.clearRect(0, 0, world.width, world.height)

        const tileSize = 16
        const cols = world.width / tileSize
        const colors = [
          '#27ae60', // 0: GRASS
          '#7f8c8d', // 1: LOW_MOUNTAIN
          '#bdc3c7', // 2: HIGH_MOUNTAIN
          '#3498db', // 3: SHALLOW_SEA
          '#2980b9', // 4: DEEP_SEA
          '#2c3e50', // 5: ABYSS
        ]

        for (let i = 0; i < world.terrain.length; i++) {
          const type = world.terrain[i]
          sCtx.fillStyle = colors[type] || colors[0]
          const tx = (i % cols) * tileSize
          const ty = Math.floor(i / cols) * tileSize
          sCtx.fillRect(tx, ty, tileSize, tileSize)
        }
        world.needsStaticTerrainUpdate = false
      }

      // ── 1. 동적 배경 업데이트 (길, 건물 등 자주 변하는 요소) ───────────────
      if (world.needsBackgroundUpdate) {
        // [Atomic Load] 배경 업데이트 시에도 워커와의 동기화를 위해 원자적 읽기 수행 (프레임 내 고정 index 사용)
        const { globals, globalsInt32 } = world.views
        const frontIndex = Atomics.load(globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)
        if (frontIndex !== 0 && frontIndex !== 1) return

        const currentSet = world.views.sets[frontIndex]
        if (!currentSet) return

        const villageView = currentSet.villages
        const villageCount = Atomics.load(globalsInt32, PROPS.GLOBALS.VILLAGE_COUNT)
        const buildingView = currentSet.buildings
        const buildingCount = Atomics.load(globalsInt32, PROPS.GLOBALS.BUILDING_COUNT)
        const ctx = world.bgBufferCtx

        ctx.clearRect(0, 0, world.width, world.height)

        // (A) 사전 렌더링된 정적 지형 복사 (가장 빠름)
        ctx.drawImage(world.bgStaticCanvas, 0, 0)

        // (B) Desire Path (자연생성된 길) 그리기 - 2중 루프로 연산 최적화
        if (world.pathSystem && world.pathSystem.paths) {
          const paths = world.pathSystem.paths
          const gridSize = world.pathSystem.gridSize
          const pCols = world.pathSystem.cols
          const pRows = world.pathSystem.rows

          // 💡 [렌더링 최적화] 수만 번의 fillRect 호출을 단 2번의 일괄(Batch) 렌더링으로 압축하여 Main Thread 프레임 드랍(멈춤) 원천 방지
          ctx.fillStyle = 'rgba(160, 120, 60, 0.4)'
          ctx.beginPath()
          for (let i = 0; i < paths.length; i++) {
            if (paths[i] > 100 && paths[i] <= 500) {
              const tx = (i % pCols) * gridSize
              const ty = Math.floor(i / pCols) * gridSize
              ctx.rect(tx, ty, gridSize, gridSize)
            }
          }
          ctx.fill()

          ctx.fillStyle = 'rgba(120, 100, 80, 0.7)'
          ctx.beginPath()
          for (let i = 0; i < paths.length; i++) {
            if (paths[i] > 500) {
              const tx = (i % pCols) * gridSize
              const ty = Math.floor(i / pCols) * gridSize
              ctx.rect(tx, ty, gridSize, gridSize)
            }
          }
          ctx.fill()
        }

        for (let i = 0; i < villageCount; i++) {
          const offset = i * STRIDE.VILLAGE
          if (villageView[offset + PROPS.VILLAGE.IS_ACTIVE] === 1) {
            const v = this.renderProxies.village
            world.bufferSyncSystem.hydrate(world, v, 'village', i, frontIndex)
            v.nation = { color: v.color, name: '국가' }
            v.render(ctx)
          }
        }

        // 버퍼 내용을 실제 배경 캔버스로 복사
        world.bgCtx.clearRect(0, 0, world.width, world.height)
        world.bgCtx.drawImage(world.bgBufferCanvas, 0, 0)
        world.needsBackgroundUpdate = false
      }

      world.ctx.drawImage(world.bgCanvas, 0, 0)

      // [Atomic Load] 메인 렌더 패스에서도 프레임 시작 시점에 인덱스 고정 (Tearing 방지)
      const frontIndex = Atomics.load(world.views.globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)
      if (frontIndex !== 0 && frontIndex !== 1) return

      const viewRange = {
        x: world.camera.x - 50,
        y: world.camera.y - 50,
        width: world.camera.width / zoom + 100,
        height: world.camera.height / zoom + 100,
      }
      const drawables = world.chunkManager.query(viewRange)

      // [Nuclear Optimization] Y-버킷 정렬 (Zero-Allocation + Hard Clear)
      this.poolIdx = 0
      this.buckets.clear() // 매 프레임 버킷을 완전히 비워 잔상 원천 차단
      let minY = 99999,
        maxY = -99999

      for (let i = 0; i < drawables.length; i++) {
        const obj = drawables[i]
        const yKey = Math.floor(obj.y)
        // [Hardening] 유효하지 않거나 무한대인 좌표 방어
        if (!Number.isFinite(yKey)) continue

        // [Hardening] 월드 경계 내로 키 제한 (루프 프리징 방지)
        const clampedY = Math.max(0, Math.min(yKey, world.height || 3200))

        let bucket = this.buckets.get(clampedY)
        if (!bucket) {
          bucket = this._getArrayFromPool()
          this.buckets.set(clampedY, bucket)
        }
        bucket.push(obj)
        if (clampedY < minY) minY = clampedY
        if (clampedY > maxY) maxY = clampedY
      }

      // 그림자 선 렌더링 (모든 엔티티 통합)
      world.lightingSystem.renderShadows(world.ctx, drawables, world.timeSystem.timeOfDay)

      // 버킷 순회하며 렌더링 (minY ~ maxY 범위로 최적화)
      if (drawables.length > 0) {
        for (let y = minY; y <= maxY; y++) {
          const bucket = this.buckets.get(y)
          if (!bucket) continue
          for (let i = 0; i < bucket.length; i++) {
            const obj = bucket[i]
            const instance = this.renderProxies[obj._type]
            if (instance) {
              const success = world.bufferSyncSystem.hydrate(
                world,
                instance,
                obj._type,
                obj.id,
                frontIndex,
              )
              if (!success || instance.isDead) continue

              if (obj._type === 'plant')
                instance.render(world.ctx, timestamp, world.weather.windSpeed)
              else instance.render(world.ctx, timestamp, world)
            }
          }
        }
      }

      // ... selection ring, particles, UI render lines ...
      world.particleSystem.render(world.ctx)
      world.weather.render(world.ctx)
      world.interactionSystem.render(world.ctx, drawables)
      world.ctx.restore()
      world.timeSystem.renderOverlay(world.ctx, world.canvas.width, world.canvas.height)
      world.lightingSystem.applyColorGrading(
        world.ctx,
        world.canvas.width,
        world.canvas.height,
        world.timeSystem.season,
        world.weather.weatherType,
        world.timeSystem.timeOfDay,
        drawables,
        world.camera,
      )
    } catch (error) {
      console.error(
        '🚨 [RenderSystem Fatal Error] 렌더링 중 치명적 오류 발생 (프레임 스킵):',
        error,
      )
      try {
        world.ctx.restore()
      } catch (e) {}
    }
  }
}
