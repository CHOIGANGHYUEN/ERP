import { useConfigStore } from '@/frontend/module_sys/SYST05/configStore'

export const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''

  const configStore = useConfigStore()
  const format = configStore.getConfigValue('FMT_DATE', 'YYYY-MM-DD')

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  if (format === 'YYYY/MM/DD') return `${yyyy}/${mm}/${dd}`
  return `${yyyy}-${mm}-${dd}`
}

export const formatDateTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''

  const configStore = useConfigStore()
  const format = configStore.getConfigValue('FMT_DATETIME', 'YYYY-MM-DD HH:mm:ss')

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')

  if (format === 'YYYY/MM/DD HH:mm:ss') return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

export const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return ''

  const configStore = useConfigStore()
  const currencyCode = configStore.getConfigValue('FMT_CURRENCY', 'KRW')
  const rounding = parseInt(configStore.getConfigValue('FMT_AMT_ROUNDING', '0'), 10)

  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: rounding,
    maximumFractionDigits: rounding,
  }).format(amount)
}
