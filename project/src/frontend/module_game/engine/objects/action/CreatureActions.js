import { WANDERING } from './creature/Wandering.js'
import { STUDYING } from './creature/Studying.js'
import { GATHERING } from './creature/Gathering.js'
import { HARVESTING } from './creature/Harvesting.js'
import { MINING } from './creature/Mining.js'
import { BUILDING } from './creature/Building.js'
import { ATTACKING } from './creature/Attacking.js'
import { RESTING } from './creature/Resting.js'
import { RETURNING } from './creature/Returning.js'
import { FLEEING } from './creature/Fleeing.js'
import { MATING } from './creature/Mating.js'
import { TRAINING } from './creature/Training.js'

export const CreatureActions = {
  WANDERING,
  IDLE: (_creature, _deltaTime, _world) => {
    /* 대기 상태 */
  },
  STUDYING,
  GATHERING,
  HARVESTING,
  MINING,
  BUILDING,
  ATTACKING,
  RESTING,
  RETURNING,
  FLEEING,
  MATING,
  TRAINING,
}
