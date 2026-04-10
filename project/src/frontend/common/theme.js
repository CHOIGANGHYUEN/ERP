/**
 * @file theme.js
 * @description Provides a JavaScript interface to dynamically control the CSS Custom Properties (Variables) defined in main.css.
 * This allows real-time theming (e.g., Light/Dark mode, Brand colors) from anywhere in the Vue/JS application.
 */

// Gets the root element for CSS variables
const root = document.documentElement

/**
 * 특정 CSS 변수 값을 동적으로 업데이트합니다.
 * @param {string} variableName - CSS 변수명 ('--' 접두어 제외, 예: 'app-bg-color')
 * @param {string} value - 적용할 새 값
 */
export function setCssVariable(variableName, value) {
  root.style.setProperty(`--${variableName}`, value)
}

/**
 * 현재 설정된 특정 CSS 변수의 값을 가져옵니다.
 * @param {string} variableName - CSS 변수명 ('--' 접두어 제외)
 * @returns {string} CSS 변수의 현재 값
 */
export function getCssVariable(variableName) {
  return getComputedStyle(root).getPropertyValue(`--${variableName}`).trim()
}

/**
 * 여러 개의 CSS 변수를 포함하는 테마 객체를 일괄 적용합니다.
 * @param {Object} theme - 테마 설정 객체 (키는 '--' 접두어가 제외된 변수명)
 */
export function applyTheme(theme) {
  for (const [key, value] of Object.entries(theme)) {
    setCssVariable(key, value)
  }
}

// ============================================================================
// Example Pre-defined Themes (미리 정의된 테마 예시)
// ============================================================================

export const lightTheme = {
  'app-bg-color': '#f8f9fa',
  'app-text-color': '#212529',
  'app-primary-color': '#007bff',
  'app-primary-hover-color': '#0056b3',
  'app-secondary-color': '#6c757d',
  'app-border-color': '#dee2e6',
  'app-surface-color': '#ffffff',
}

export const darkTheme = {
  'app-bg-color': '#121212',
  'app-text-color': '#f8f9fa',
  'app-primary-color': '#0d6efd',
  'app-primary-hover-color': '#3b82f6',
  'app-secondary-color': '#adb5bd',
  'app-border-color': '#495057',
  'app-surface-color': '#1e1e1e',
}
