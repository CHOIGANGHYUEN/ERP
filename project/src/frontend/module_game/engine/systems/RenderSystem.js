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
      const zoom = world.camera.zoom || 1
      const ctx = world.ctx
      ctx.clearRect(0, 0, world.canvas.width, world.canvas.height)
      ctx.imageSmoothingEnabled = false
      ctx.save()
      ctx.scale(zoom, zoom)
      ctx.translate(-world.camera.x, -world.camera.y)
      world.disasterSystem.applyCameraShake(ctx)

      // [Atomic Load] 메인 렌더 패스를 위한 데이터 고정 (Tearing 방지)
      const { globals, globalsInt32, sets } = world.views
      const frontIndex = Atomics.load(globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)
      if (frontIndex !== 0 && frontIndex !== 1) return

      const currentSet = sets[frontIndex]
      const villageView = currentSet.villages
      const villageCount = Atomics.load(globalsInt32, PROPS.GLOBALS.VILLAGE_COUNT)

      // ── 0단계: 정적 지형 (배경 이미지) ──────────────────────────────────
      if (world.needsStaticTerrainUpdate && world.terrain) {
        const sCtx = world.bgStaticCtx
        sCtx.clearRect(0, 0, world.width, world.height)
        const cols = world.width / 16
        const colors = ['#27ae60', '#7f8c8d', '#bdc3c7', '#3498db', '#2980b9', '#2c3e50']
        for (let i = 0; i < world.terrain.length; i++) {
          sCtx.fillStyle = colors[world.terrain[i]] || colors[0]
          sCtx.fillRect((i % cols) * 16, Math.floor(i / cols) * 16, 16, 16)
        }
        world.needsStaticTerrainUpdate = false
      }
      ctx.drawImage(world.bgStaticCanvas, 0, 0)

      // ── 1단계: 정치적 영토 (Political Grid) ───────────────────────────────
      const territory = world.views?.territory || world.territory
      if (world.settings?.showTerritory !== false && territory) {
        for (let ty = 0; ty < 200; ty++) {
          for (let tx = 0; tx < 200; tx++) {
            const vIdx = territory[ty * 200 + tx]
            if (vIdx > 0 && vIdx <= villageCount) {
              const vOffset = (vIdx - 1) * STRIDE.VILLAGE
              const r = Math.round(villageView[vOffset + PROPS.VILLAGE.R] * 255)
              const g = Math.round(villageView[vOffset + PROPS.VILLAGE.G] * 255)
              const b = Math.round(villageView[vOffset + PROPS.VILLAGE.B] * 255)
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`
              ctx.fillRect(tx * 16, ty * 16, 16, 16)
            }
          }
        }
      }

      // ── 2단계: 마을 영역 (Influence Radius) ─────────────────────────────
      if (world.settings?.showVillageArea !== false) {
        for (let i = 0; i < villageCount; i++) {
          const vOffset = i * STRIDE.VILLAGE
          if (villageView[vOffset + PROPS.VILLAGE.IS_ACTIVE] === 1) {
            const r = Math.round(villageView[vOffset + PROPS.VILLAGE.R] * 255)
            const g = Math.round(villageView[vOffset + PROPS.VILLAGE.G] * 255)
            const b = Math.round(villageView[vOffset + PROPS.VILLAGE.B] * 255)
            const vx = villageView[vOffset + PROPS.VILLAGE.X]
            const vy = villageView[vOffset + PROPS.VILLAGE.Y]
            const vr = villageView[vOffset + PROPS.VILLAGE.RADIUS] || 100

            ctx.beginPath()
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`
            ctx.lineWidth = 4
            ctx.arc(vx, vy, vr, 0, Math.PI * 2)
            ctx.stroke()
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.05)`
            ctx.fill()
          }
        }
      }

      // ── 3단계: 지면 경로 (Paths) ──────────────────────────────────────
      if (world.pathSystem && world.pathSystem.paths) {
        ctx.fillStyle = 'rgba(120, 100, 80, 0.4)'
        ctx.beginPath()
        for (let i = 0; i < world.pathSystem.paths.length; i++) {
          if (world.pathSystem.paths[i] > 200) {
            ctx.rect((i % 200) * 16, Math.floor(i / 200) * 16, 16, 16)
          }
        }
        ctx.fill()
      }

      // [Nuclear Optimization] Y-버킷 정렬 및 SAB 직접 순회 (Zero-Allocation + Hard Clear)
      this.poolIdx = 0
      this.buckets.clear() // 매 프레임 버킷을 완전히 비워 잔상 원천 차단
      let minY = 99999,
        maxY = -99999

      if (!this.nodePool) {
        this.nodePool = []
      }
      this.nodePoolIdx = 0

      const bounds = {
        x: world.camera.x - 50,
        y: world.camera.y - 50,
        width: world.camera.width / zoom + 100,
        height: world.camera.height / zoom + 100,
      }

      const addDrawablesFromSAB = (typeName, countProp, viewArray, stride) => {
        const count = Atomics.load(globalsInt32, countProp)
        for (let i = 0; i < count; i++) {
          const offset = i * stride
          // IS_ACTIVE가 1인지 확인
          if (viewArray[offset] === 1) {
            const tx = viewArray[offset + 1]
            const ty = viewArray[offset + 2]

            // Camera Culling
            if (tx >= bounds.x && tx <= bounds.x + bounds.width &&
              ty >= bounds.y && ty <= bounds.y + bounds.height) {

              const yKey = Math.floor(ty)
              if (!Number.isFinite(yKey)) continue
              const clampedY = Math.max(0, Math.min(yKey, world.height || 3200))

              let bucket = this.buckets.get(clampedY)
              if (!bucket) {
                bucket = this._getArrayFromPool()
                this.buckets.set(clampedY, bucket)
              }

              // Zero-allocation 노드 생성
              let node = this.nodePool[this.nodePoolIdx++]
              if (!node) {
                node = { _type: '', id: 0, x: 0, y: 0, size: 0, isConstructed: false }
                this.nodePool.push(node)
              }
              node._type = typeName
              node.id = i
              node.x = tx
              node.y = ty
              node.size = viewArray[offset + 3] || 16 // SIZE: 3
              node.isConstructed = typeName === 'building' ? viewArray[offset + 9] === 1 : true // IS_CONSTRUCTED: 9

              bucket.push(node)
              if (clampedY < minY) minY = clampedY
              if (clampedY > maxY) maxY = clampedY
            }
          }
        }
      }

      // SAB 순회 (Main Thread의 죽은 ChunkManager 대신 메모리를 직접 스캔)
      addDrawablesFromSAB('creature', PROPS.GLOBALS.CREATURE_COUNT, currentSet.creatures, STRIDE.CREATURE)
      addDrawablesFromSAB('animal', PROPS.GLOBALS.ANIMAL_COUNT, currentSet.animals, STRIDE.ANIMAL)
      addDrawablesFromSAB('plant', PROPS.GLOBALS.PLANT_COUNT, currentSet.plants, STRIDE.PLANT)
      addDrawablesFromSAB('resource', PROPS.GLOBALS.RESOURCE_COUNT, currentSet.resources, STRIDE.RESOURCE)
      addDrawablesFromSAB('building', PROPS.GLOBALS.BUILDING_COUNT, currentSet.buildings, STRIDE.BUILDING)
      addDrawablesFromSAB('mine', PROPS.GLOBALS.MINE_COUNT, currentSet.mines, STRIDE.MINE)
      addDrawablesFromSAB('tornado', PROPS.GLOBALS.TORNADO_COUNT, currentSet.tornadoes, STRIDE.TORNADO)

      // Lighting 및 Interaction 시스템을 위해 평면화된 drawables 배열 구성 (Zero-allocation)
      if (!this.drawablesPool) {
        this.drawablesPool = []
      }
      const drawables = this.drawablesPool
      drawables.length = 0

      if (minY <= maxY) {
        for (let y = minY; y <= Math.ceil(maxY); y++) {
          const bucket = this.buckets.get(y)
          if (bucket) {
            for (let i = 0; i < bucket.length; i++) {
              drawables.push(bucket[i])
            }
          }
        }
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
      world.interactionSystem.render(world.ctx, drawables, world)
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
      } catch (e) { }
    }
  }
}
