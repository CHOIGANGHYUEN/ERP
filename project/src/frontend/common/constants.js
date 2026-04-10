/**
 * Frontend Global Constants
 * Read-only system variables accessible by developers.
 */
export const AppConstants = Object.freeze({
  // Modules
  MODULES: Object.freeze({
    FI: 'Financial Accounting',
    HR: 'Human Resources',
    MM: 'Materials Management',
    SD: 'Sales and Distribution',
    SYS: 'System Administration',
  }),

  // User Roles
  ROLES: Object.freeze({
    ADMIN: 'ROLE_ADMIN',
    USER: 'ROLE_USER',
  }),

  // Formats
  FORMATS: Object.freeze({
    DATE: 'YYYY-MM-DD',
    DATETIME: 'YYYY-MM-DD HH:mm:ss',
  }),

  // Pagination Default
  PAGINATION: Object.freeze({
    DEFAULT_PAGE: 1,
    DEFAULT_SIZE: 20,
  }),

  // API Configuration
  API: Object.freeze({
    TIMEOUT: 10000, // 10 seconds
  }),
})
