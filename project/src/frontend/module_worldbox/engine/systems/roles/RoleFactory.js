import { JobTypes } from '../../config/JobTypes.js';
import ChiefRole     from './ChiefRole.js';
import ArchitectRole from './ArchitectRole.js';
import LoggerRole    from './LoggerRole.js';
import GathererRole  from './GathererRole.js';
import HunterRole    from './HunterRole.js';
import MinerRole     from './MinerRole.js';
import { FarmerRole, RancherRole, WarriorRole, MerchantRole, BlacksmithRole, CarpenterRole } from './OtherRoles.js';

/**
 * 🏭 RoleFactory
 * JobType 문자열을 받아 해당 Role 인스턴스를 반환합니다.
 * system 참조를 인자로 받아 각 Role이 엔진에 접근할 수 있게 합니다.
 */
export default class RoleFactory {
    constructor(system) {
        this.system = system;
        this.roles = new Map();

        this._registerDefaults();
    }

    _registerDefaults() {
        this.registerRole(JobTypes.CHIEF, ChiefRole);
        this.registerRole(JobTypes.ARCHITECT, ArchitectRole);
        this.registerRole(JobTypes.LOGGER, LoggerRole);
        this.registerRole(JobTypes.GATHERER, GathererRole);
        this.registerRole(JobTypes.HUNTER, HunterRole);
        this.registerRole(JobTypes.MINER, MinerRole);
        this.registerRole(JobTypes.FARMER, FarmerRole);
        this.registerRole(JobTypes.RANCHER, RancherRole);
        this.registerRole(JobTypes.WARRIOR, WarriorRole);
        this.registerRole(JobTypes.MERCHANT, MerchantRole);
        this.registerRole(JobTypes.BLACKSMITH, BlacksmithRole);
        this.registerRole(JobTypes.CARPENTER, CarpenterRole);
    }

    registerRole(jobType, roleClass) {
        this.roles.set(jobType, roleClass);
    }

    /**
     * @param {string} jobType - JobTypes 상수
     * @returns {BaseRole|null}
     */
    createRole(jobType) {
        const RoleClass = this.roles.get(jobType);
        if (RoleClass) {
            return new RoleClass(this.system);
        }
        return null;
    }
}
