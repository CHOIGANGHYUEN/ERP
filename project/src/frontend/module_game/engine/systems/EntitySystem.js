export class EntitySystem {
  update(deltaTime, world) {
    world.creatures.forEach((c) => c.update(deltaTime, world))
    world.plants.forEach((p) => p.update(deltaTime, world))
    world.resources.forEach((r) => r.update(deltaTime, world))
    world.animals.forEach((a) => a.update(deltaTime, world))
    world.mines.forEach((m) => m.update(deltaTime, world))
  }
}
