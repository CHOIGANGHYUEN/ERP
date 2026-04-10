/**
 * Backend Global Formatters
 * Utility functions for consistent data formatting and parsing on the server.
 */

const Formatters = {
  /**
   * Formats a date string or Date object to YYYY-MM-DD for database insertion.
   * @param {string|Date} date - The date to format.
   * @returns {string|null} Formatted date string or null if invalid.
   */
  formatDateForDB(date) {
    if (!date) return null
    const d = new Date(date)
    if (isNaN(d.getTime())) return null

    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  },

  /**
   * Formats a date string or Date object to YYYY-MM-DD HH:mm:ss for database insertion.
   * @param {string|Date} date - The date to format.
   * @returns {string|null} Formatted datetime string or null if invalid.
   */
  formatDateTimeForDB(date) {
    if (!date) return null
    const d = new Date(date)
    if (isNaN(d.getTime())) return null

    const datePart = this.formatDateForDB(d)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')

    return `${datePart} ${hours}:${minutes}:${seconds}`
  },

  /**
   * Parses a boolean value safely from various input types.
   * @param {any} value - The value to parse ('true', '1', 1, true).
   * @returns {boolean}
   */
  parseBoolean(value) {
    if (value === true || value === 1 || value === '1' || value === 'true') return true
    return false
  },
}

export default Formatters
