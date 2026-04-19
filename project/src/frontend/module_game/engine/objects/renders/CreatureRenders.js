import { WANDERING }  from './creature/Wandering.js'
import { GATHERING }  from './creature/Gathering.js'
import { HARVESTING } from './creature/Harvesting.js'
import { MINING }     from './creature/Mining.js'
import { BUILDING }   from './creature/Building.js'
import { ATTACKING }  from './creature/Attacking.js'
import { STUDYING }   from './creature/Studying.js'
import { RETURNING }  from './creature/Returning.js'
import { TRAINING }   from './creature/Training.js'
import { RESTING }    from './creature/Resting.js'
import { MATING }     from './creature/Mating.js'
import { FLEEING }    from './creature/Fleeing.js'
import { EATING }     from './creature/Eating.js'
import { DEPOSITING } from './creature/Depositing.js'
import { SUFFERING }  from './creature/Suffering.js'

export const CreatureRenders = {
  WANDERING,
  GATHERING,
  HARVESTING,
  MINING,
  BUILDING,
  ATTACKING,
  STUDYING,
  RETURNING,
  TRAINING,
  RESTING,
  MATING,
  FLEEING,
  EATING,
  DEPOSITING,
  SUFFERING,
  // 동의어 매핑 (상태명 차이 대응)
  IDLE:       WANDERING,
  TRADING:    RETURNING,
}
