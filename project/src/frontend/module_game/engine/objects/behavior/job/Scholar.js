export const SCHOLAR = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)
  const schools = creature.village.buildings.filter((b) => b.type === 'SCHOOL' && b.isConstructed)
  if (schools.length > 0) {
    creature.target = schools[Math.floor(Math.random() * schools.length)]
    creature.state = 'STUDYING'
  } else {
    creature.wander(world)
  }
}
