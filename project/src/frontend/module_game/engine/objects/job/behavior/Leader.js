import { JobAssigner } from '../JobAssigner.js'

export const LEADER = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)
  if (Math.random() < 0.1) {
    const adults = creature.village.creatures.filter((c) => c.isAdult && c.profession !== 'LEADER')
    adults.forEach((c) => JobAssigner.forceAssignJob(world, c))
  }
  creature.wander(world, 50)
}
