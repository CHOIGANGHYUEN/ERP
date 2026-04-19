import { Creature } from '../objects/life/Creature.js'
import { Animal } from '../objects/life/Animal.js'
import { Plant } from '../objects/life/Plant.js'
import { Resource } from '../objects/environment/Resource.js'
import { Building } from '../objects/society/Building.js'
import { Nation } from '../objects/society/Nation.js'
import { Village } from '../objects/society/Village.js'
import { Mine } from '../objects/environment/Mine.js'
import { MAX_CREATURES } from '../core/SharedState.js'

export class EntitySpawnerSystem {
  getSafeLandPosition(world, preferTerrainType = -1) {
    let x, y
    let attempts = 0
    let bestX = 0, bestY = 0
    let bestScore = -1

    while (attempts < 50) {
      x = Math.random() * world.width
      y = Math.random() * world.height
      attempts++

      if (!world.terrain) return { x, y }

      const cols = Math.ceil(world.width / 16)
      const tx = Math.floor(x / 16)
      const ty = Math.floor(y / 16)
      if (tx >= 0 && tx < cols && ty >= 0 && ty < Math.ceil(world.height / 16)) {
        const type = world.terrain[ty * cols + tx]

        // 3 이상은 바다, 2는 대산맥 (이곳은 무조건 제외)
        if (type >= 3 || type === 2) continue

        // 우선순위가 있는 경우 (예: 광물은 1번(낮은 산) 강하게 선호)
        if (preferTerrainType !== -1) {
          if (type === preferTerrainType) return { x, y }
          // 조건 불만족시 일단 점수가 높은 차선책 갱신
          bestX = x
          bestY = y
        } else {
          return { x, y }
        }
      }
    }
    // 50번 못찾으면 차선책 반환 또는 중앙
    return (bestX !== 0 || bestY !== 0) ? { x: bestX, y: bestY } : { x: world.width / 2, y: world.height / 2 }
  }

  initNature(world) {
    for (let i = 0; i < 100; i++) {
      const pos = this.getSafeLandPosition(world, 0)
      world.spawnPlant(pos.x, pos.y, 'grass')
    }
    for (let i = 0; i < 30; i++) {
      const pos = this.getSafeLandPosition(world, 0)
      world.spawnPlant(pos.x, pos.y, 'tree')
    }

    const herbivores = ['RABBIT', 'DEER', 'SHEEP', 'COW', 'BOAR', 'ELEPHANT', 'MAMMOTH']
    for (let i = 0; i < 20; i++) {
      const pos = this.getSafeLandPosition(world, 0)
      world.spawnAnimal(pos.x, pos.y, herbivores[Math.floor(Math.random() * herbivores.length)])
    }

    const carnivores = ['WOLF', 'BEAR', 'FOX', 'TIGER', 'LION']
    for (let i = 0; i < 8; i++) {
      const pos = this.getSafeLandPosition(world, 0)
      world.spawnAnimal(pos.x, pos.y, carnivores[Math.floor(Math.random() * carnivores.length)])
    }

    const _mineTypes = [
      'stone',
      'coal',
      'copper',
      'iron',
      'silver',
      'gold',
      'diamond',
      'ruby',
      'emerald',
      'sapphire',
      'uranium',
    ]
    for (let i = 0; i < 40; i++) {
      const rand = Math.random()
      let mType = 'stone'
      if (rand > 0.95) mType = 'uranium'
      else if (rand > 0.9) mType = 'diamond'
      else if (rand > 0.85) mType = 'ruby'
      else if (rand > 0.8) mType = 'emerald'
      else if (rand > 0.75) mType = 'sapphire'
      else if (rand > 0.65) mType = 'gold'
      else if (rand > 0.5) mType = 'silver'
      else if (rand > 0.35) mType = 'copper'
      else if (rand > 0.2) mType = 'iron'
      else if (rand > 0.1) mType = 'coal'
      
      const pos = this.getSafeLandPosition(world, 1) // 1: 낮은산(LOW_MOUNTAIN)
      world.mines.push(new Mine(pos.x, pos.y, mType))
    }
  }

  spawnCreature(world, x, y) {
    if (!world.isHeadless && world.onProxyAction)
      return world.onProxyAction({ type: 'SPAWN_CREATURE', payload: { x, y } })
    let creature
    if (world.creatures.length < MAX_CREATURES && world.creaturePool.length > 0) {
      creature = world.creaturePool.pop()
      creature.reset(x, y)
    } else {
      creature = new Creature(x, y)
    }
    world.creatures.push(creature)

    let joinedVillage = null
    for (const village of world.villages) {
      if (Math.sqrt(Math.pow(village.x - x, 2) + Math.pow(village.y - y, 2)) < village.radius) {
        village.addCreature(creature)
        joinedVillage = village
        break
      }
    }

    if (!joinedVillage) {
      const newVillage = new Village(x, y, `마을 ${world.villages.length + 1}`)
      world.villages.push(newVillage)
      newVillage.addCreature(creature)

      let assignedNation = null
      for (const nation of world.nations) {
        const closestVillageDist = Math.min(...nation.villages.map((v) => v.distanceTo(newVillage)))
        if (closestVillageDist < 500) {
          assignedNation = nation
          break
        }
      }

      if (assignedNation) assignedNation.addVillage(newVillage)
      else {
        const nationColors = ['#9b59b6', '#3498db', '#e74c3c', '#2ecc71', '#f1c40f']
        const newNation = new Nation(
          `왕국 ${world.nations.length + 1}`,
          nationColors[world.nations.length % nationColors.length],
        )
        world.nations.push(newNation)
        newNation.addVillage(newVillage)
        world.broadcastEvent(
          `새로운 국가 [${newNation.name}]이(가) 건국되었습니다!`,
          newNation.color,
        )
      }
    }
  }

  spawnAnimal(world, x, y, type) {
    if (!world.isHeadless && world.onProxyAction)
      return world.onProxyAction({ type: 'SPAWN_ANIMAL', payload: { x, y, type } })
    const HERBIVORES = ['RABBIT', 'DEER', 'SHEEP', 'COW', 'BOAR', 'ELEPHANT', 'MAMMOTH']
    const CARNIVORES = ['WOLF', 'BEAR', 'FOX', 'TIGER', 'LION']
    const actualType =
      type === 'HERBIVORE' || type === 'CARNIVORE'
        ? type
        : CARNIVORES.includes(type)
          ? 'CARNIVORE'
          : 'HERBIVORE'
    let animal = world.animalPool.length > 0 ? world.animalPool.pop() : new Animal(x, y, actualType)
    if (world.animalPool.length > 0) animal.reset(x, y, actualType)
    const SPECIES_PROPS = {
      RABBIT: { color: '#ecf0f1', size: 6 },
      DEER: { color: '#cd84f1', size: 10 },
      SHEEP: { color: '#dfe6e9', size: 9 },
      COW: { color: '#636e72', size: 14 },
      BOAR: { color: '#833471', size: 11 },
      ELEPHANT: { color: '#b2bec3', size: 25 },
      MAMMOTH: { color: '#6c5ce7', size: 28 },
      WOLF: { color: '#7f8fa6', size: 10 },
      BEAR: { color: '#B53471', size: 18 },
      FOX: { color: '#e15f41', size: 7 },
      TIGER: { color: '#f39c12', size: 15 },
      LION: { color: '#f1c40f', size: 16 },
    }
    animal.species =
      type === 'HERBIVORE' || type === 'CARNIVORE'
        ? type === 'CARNIVORE'
          ? CARNIVORES[Math.floor(Math.random() * CARNIVORES.length)]
          : HERBIVORES[Math.floor(Math.random() * HERBIVORES.length)]
        : type
    if (SPECIES_PROPS[animal.species]) {
      animal.color = SPECIES_PROPS[animal.species].color
      animal.baseSize = SPECIES_PROPS[animal.species].size
    }
    world.animals.push(animal)
  }

  spawnBuilding(world, x, y, type, village) {
    if (!world.isHeadless && world.onProxyAction)
      return world.onProxyAction({
        type: 'SPAWN_BUILDING',
        payload: { x, y, type, villageId: village?.id },
      })
    const snapX = Math.floor(x / 32) * 32 + 16,
      snapY = Math.floor(y / 32) * 32 + 16
    if (world.buildings.some((b) => Math.abs(b.x - snapX) < 32 && Math.abs(b.y - snapY) < 32))
      return
    const b = new Building(snapX, snapY, type)
    b.occupants = []
    b.capacity = type === 'HOUSE' ? 1 + (b.tier || 1) : 0
    world.buildings.push(b)
    if (village) village.addBuilding(b)
  }

  spawnPlant(world, x, y, type) {
    if (!world.isHeadless && world.onProxyAction)
      return world.onProxyAction({ type: 'SPAWN_PLANT', payload: { x, y, type } })
    if (
      world.plants.length < world.maxPlants &&
      x > 10 &&
      x < world.width - 10 &&
      y > 10 &&
      y < world.height - 10
    )
      world.plants.push(new Plant(x, y, type))
  }
  removePlant(world, plant) {
    world.plants = world.plants.filter((p) => p !== plant)
  }

  spawnResource(world, x, y, type) {
    let resource =
      world.resourcePool.length > 0 ? world.resourcePool.pop() : new Resource(x, y, type)
    if (world.resourcePool.length > 0) resource.reset(x, y, type)
    const RESOURCE_COLORS = {
      food: '#e74c3c',
      wood: '#8e44ad',
      stone: '#7f8c8d',
      coal: '#2c3e50',
      copper: '#d35400',
      iron: '#e67e22',
      silver: '#bdc3c7',
      gold: '#f1c40f',
      diamond: '#00cec9',
      ruby: '#c0392b',
      emerald: '#2ecc71',
      sapphire: '#0984e3',
      uranium: '#00b894',
      biomass: '#27ae60',
      knowledge: '#9b59b6',
      milk: '#ecf0f1',
      meat: '#c0392b',
    }
    if (RESOURCE_COLORS[type]) resource.color = RESOURCE_COLORS[type]
    world.resources.push(resource)
  }
  removeResource(world, resource) {
    world.resources = world.resources.filter((r) => r !== resource)
    world.resourcePool.push(resource)
  }

  loadCreatures(world, creaturesData) {
    if (!world.isHeadless && world.onProxyAction)
      return world.onProxyAction({ type: 'LOAD_CREATURES', payload: { creaturesData } })
    world.creatures = creaturesData.map((data) => {
      let c
      if (world.creaturePool.length > 0) {
        c = world.creaturePool.pop()
        c.reset(data.x, data.y)
      } else {
        c = new Creature(data.x, data.y)
      }
      if (data.color) c.color = data.color
      return c
    })
  }
}
