export default class State {
    constructor(system) {
        this.system = system;
    }

    enter(entityId, entity) {}

    /**
     * Updates the state.
     * @returns {string|null} The name of the next state to transition to, or null to stay.
     */
    update(entityId, entity, dt) {
        return null;
    }

    exit(entityId, entity) {}
}
