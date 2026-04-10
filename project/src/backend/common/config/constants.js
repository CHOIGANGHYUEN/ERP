/**
 * Backend Global Constants
 * Read-only system variables accessible by developers.
 */
const SysConstants = Object.freeze({
  // HTTP Status Codes
  HTTP_STATUS: Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  }),

  // User Roles
  ROLES: Object.freeze({
    ADMIN: 'ROLE_ADMIN',
    USER: 'ROLE_USER',
  }),

  // Pagination Default
  PAGINATION: Object.freeze({
    DEFAULT_PAGE: 1,
    DEFAULT_SIZE: 20,
  }),

  // Database standard fields
  DB_DEFAULTS: Object.freeze({
    SYSTEM_USER: 'system',
  }),
})

export default SysConstants
