import { DRIVE } from '../emotions/CreatureEmotion.js'

export const SurvivalBehaviors = {
  [DRIVE.PANIC]: (creature, payload, _world) => {
    creature.state = 'FLEEING'
    creature.targetX = creature.x + (creature.x - payload.threat.x)
    creature.targetY = creature.y + (creature.y - payload.threat.y)
    creature.target = null
  },
  [DRIVE.MATING]: (creature, payload, _world) => {
    creature.target = payload.partner
    creature.state = 'MATING'
    payload.partner.target = creature
    payload.partner.state = 'MATING'
    creature.matingCooldown = 20000
    payload.partner.matingCooldown = 20000
  },
  [DRIVE.SLEEP]: (creature, payload, _world) => {
    if (payload.house) {
      creature.target = payload.house
      creature.state = 'RESTING'
    } else if (payload.village) {
      creature.target = payload.village
      creature.state = 'RETURNING'
    }
  },
  [DRIVE.EAT]: (creature, payload, _world) => {
    if (payload.food) {
      creature.target = payload.food
      creature.state = 'GATHERING'
    } else if (payload.village) {
      creature.target = payload.village
      creature.state = 'RETURNING'
    }
  },
  [DRIVE.SOCIAL]: (creature, payload, world) => {
    const emojis = ['👋 안녕!', '❤️', '🍞 배고파', '😡', '🤝 거래할까?', '🤔 흠..', '💤 피곤해']
    const text = emojis[Math.floor(Math.random() * emojis.length)]
    const idx = world.creatures.indexOf(creature)
    if (idx !== -1) world.showSpeechBubble(idx, 'creature', text, 2000)
  },
  [DRIVE.NONE]: (_creature, _payload, _world) => {},
}
