export class BuildingSystem {
  update(deltaTime, world) {
    world.buildings.forEach((b) => {
      const wasConstructed = b.isConstructed
      b.update(deltaTime, world)

      if (wasConstructed !== b.isConstructed) {
        world.needsBackgroundUpdate = true
      }

      // Phase 3: 목장(RANCH) 자원 생산 및 젖소 사육/도축 로직
      if (b.isConstructed && b.type === 'RANCH') {
        b.ranchTimer = (b.ranchTimer || 0) + deltaTime
        if (b.ranchTimer > 5000) {
          b.ranchTimer = 0
          const nearbyCows = world.animals.filter(
            (a) =>
              !a.isDead &&
              a.species === 'COW' &&
              Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) < 150,
          )

          if (nearbyCows.length < 3 && Math.random() < 0.4) {
            world.spawnAnimal(
              b.x + (Math.random() - 0.5) * 50,
              b.y + (Math.random() - 0.5) * 50,
              'COW',
            )
          }

          nearbyCows.forEach((cow) => {
            if (Math.random() < 0.5)
              world.spawnResource(
                cow.x + (Math.random() - 0.5) * 20,
                cow.y + (Math.random() - 0.5) * 20,
                'milk',
              )
            cow.ranchAge = (cow.ranchAge || 0) + 5000
            if (cow.ranchAge > 40000) {
              cow.die(world)
              for (let i = 0; i < 3; i++)
                world.spawnResource(
                  cow.x + (Math.random() - 0.5) * 20,
                  cow.y + (Math.random() - 0.5) * 20,
                  'meat',
                )
              world.spawnParticle(cow.x, cow.y, { color: '#c0392b', count: 15, speed: 40 })
            }
          })
        }
      }
    })
  }
}
