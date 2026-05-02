import { JobTypes } from '../../config/JobTypes.js';
import ChiefRole     from './ChiefRole.js';
import ArchitectRole from './ArchitectRole.js';
import LoggerRole    from './LoggerRole.js';
import GathererRole  from './GathererRole.js';
import HunterRole    from './HunterRole.js';
import { FarmerRole, RancherRole, WarriorRole, MerchantRole, BlacksmithRole, CarpenterRole } from './OtherRoles.js';

/**
 * 🏭 RoleFactory
 * JobType 문자열을 받아 해당 Role 인스턴스를 반환합니다.
 * system 참조를 인자로 받아 각 Role이 엔진에 접근할 수 있게 합니다.
 */
export default class RoleFactory {
    constructor(system) {
        this.system = system;
    }

    /**
     * @param {string} jobType - JobTypes 상수
     * @returns {BaseRole|null}
     */
    createRole(jobType) {
        switch (jobType) {
            case JobTypes.CHIEF:      return new ChiefRole(this.system);
            case JobTypes.ARCHITECT:  return new ArchitectRole(this.system);
            case JobTypes.LOGGER:     return new LoggerRole(this.system);
            case JobTypes.GATHERER:   return new GathererRole(this.system);
            case JobTypes.HUNTER:     return new HunterRole(this.system);
            case JobTypes.FARMER:     return new FarmerRole(this.system);
            case JobTypes.RANCHER:    return new RancherRole(this.system);
            case JobTypes.WARRIOR:    return new WarriorRole(this.system);
            case JobTypes.MERCHANT:   return new MerchantRole(this.system);
            case JobTypes.BLACKSMITH: return new BlacksmithRole(this.system);
            case JobTypes.CARPENTER:  return new CarpenterRole(this.system);
            case JobTypes.UNEMPLOYED:
            default:
                return null;
        }
    }
}
