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
  render(world, timestamp) {
    if (world.isHeadless || !world.views) return

    world.ctx.clearRect(0, 0, world.canvas.width, world.canvas.height)
    world.ctx.imageSmoothingEnabled = false
    world.ctx.save()

    const zoom = world.camera.zoom || 1
    world.ctx.scale(zoom, zoom)
    world.ctx.translate(-world.camera.x, -world.camera.y)
    world.disasterSystem.applyCameraShake(world.ctx)

    if (world.needsBackgroundUpdate) {
      const villageView = world.views.villages
      const villageCount = world.views.globals[PROPS.GLOBALS.VILLAGE_COUNT]
      const buildingView = world.views.buildings
      const buildingCount = world.views.globals[PROPS.GLOBALS.BUILDING_COUNT]

      world.bgCtx.clearRect(0, 0, world.width, world.height)

      for (let i = 0; i < villageCount; i++) {
        const offset = i * STRIDE.VILLAGE
        if (villageView[offset + PROPS.VILLAGE.IS_ACTIVE] === 1) {
          const vData = world.getDataFromBuffer(world._type || 'village', i)
          const v = new Village(vData.x, vData.y)
          Object.assign(v, vData)
          v.nation = { color: vData.color }
          v.render(world.bgCtx)
        }
      }

      for (let i = 0; i < buildingCount; i++) {
        const offset = i * STRIDE.BUILDING
        if (buildingView[offset + PROPS.BUILDING.IS_CONSTRUCTED] === 1) {
          const bData = world.getDataFromBuffer(world._type || 'building', i)
          const b = new Building(bData.x, bData.y, bData.type)
          Object.assign(b, bData)
          b.render(world.bgCtx)
        }
      }
      world.needsBackgroundUpdate = false
    }

    world.ctx.drawImage(world.bgCanvas, 0, 0)

    const viewRange = {
      x: world.camera.x - 50,
      y: world.camera.y - 50,
      width: world.camera.width / zoom + 100,
      height: world.camera.height / zoom + 100,
    }
    const drawables = world.chunkManager.query(viewRange)
    drawables.sort((a, b) => a.y - b.y)

    world.lightingSystem.renderShadows(world.ctx, drawables, world.timeSystem.timeOfDay)

    drawables.forEach((obj) => {
      const data = world.getDataFromBuffer(obj._type, obj.id)
      if (!data || data.isDead) return
      const Cls = {
        creature: Creature,
        plant: Plant,
        animal: Animal,
        building: Building,
        tornado: Tornado,
        mine: Mine,
        resource: Resource,
      }[obj._type]
      if (Cls) {
        const instance = Object.create(Cls.prototype)
        Object.assign(instance, data)
        if (obj._type === 'building' && instance.isConstructed) return
        if (obj._type === 'plant') instance.render(world.ctx, timestamp, world.weather.windSpeed)
        else instance.render(world.ctx, timestamp)
      }
    })

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
  }
}
