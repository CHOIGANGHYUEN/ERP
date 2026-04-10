import { AppConstants } from '../constants.js'

/**
 * Frontend Global Formatters
 * Utility functions for consistent data formatting across the application.
 */

export const Formatters = {
  /**
   * Formats a date string or Date object to YYYY-MM-DD.
   * @param {string|Date} date - The date to format.
   * @returns {string} Formatted date string.
   */
  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''

    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  },

  /**
   * Formats a date string or Date object to YYYY-MM-DD HH:mm:ss.
   * @param {string|Date} date - The date to format.
   * @returns {string} Formatted datetime string.
   */
  formatDateTime(date) {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''

    const datePart = this.formatDate(d)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')

    return `${datePart} ${hours}:${minutes}:${seconds}`
  },

  /**
   * Formats a number as a currency string (e.g., 1,000,000).
   * @param {number|string} value - The value to format.
   * @param {string} currency - Optional currency symbol (e.g., '₩', '$').
   * @returns {string} Formatted currency string.
   */
  formatCurrency(value, currency = '') {
    if (value === null || value === undefined || isNaN(Number(value))) return '0'
    const number = Number(value)
    const formatted = new Intl.NumberFormat('ko-KR').format(number)
    return currency ? `${currency}${formatted}` : formatted
  },

  /**
   * Masks sensitive information like email or phone number.
   * @param {string} value - The string to mask.
   * @param {string} type - 'email' | 'phone'
   * @returns {string} Masked string.
   */
  maskData(value, type = 'email') {
    if (!value) return ''
    if (type === 'email') {
      const [name, domain] = value.split('@')
      if (!domain) return value
      const maskedName = name.length > 2 ? `${name.substring(0, 2)}***` : `${name}***`
      return `${maskedName}@${domain}`
    }
    return value
  },
}
