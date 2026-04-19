/**
 * excelExport.js
 * SheetJS(xlsx) 기반 엑셀 내보내기 공통 유틸리티
 *
 * 단일 시트 / 다중 시트 workbook 모두 지원합니다.
 */
import * as XLSX from 'xlsx'

/**
 * 단일 시트 엑셀 다운로드
 * @param {Array<Array<any>>} data  - 2차원 배열 (첫 행 = 헤더)
 * @param {string} fileName         - 다운로드할 파일명 (확장자 포함)
 * @param {string} sheetName        - 시트 이름
 */
export function exportSingleSheet(data, fileName, sheetName = 'Sheet1') {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  _applyColumnWidths(ws, data)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

/**
 * 다중 시트 엑셀 다운로드
 * @param {Array<{name: string, data: Array<Array<any>>}>} sheets  - 시트 배열
 * @param {string} fileName                                         - 다운로드할 파일명
 */
export function exportMultiSheet(sheets, fileName) {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data)
    _applyColumnWidths(ws, sheet.data)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }
  XLSX.writeFile(wb, fileName)
}

/**
 * 컬럼 너비 자동 계산 (가장 긴 셀 기준)
 */
function _applyColumnWidths(ws, data) {
  if (!data || data.length === 0) return
  const colCount = Math.max(...data.map((row) => row.length))
  const colWidths = Array.from({ length: colCount }, (_, colIdx) => {
    const maxLen = data.reduce((max, row) => {
      const cell = row[colIdx]
      const len = cell == null ? 0 : String(cell).length
      return Math.max(max, len)
    }, 0)
    return { wch: Math.min(Math.max(maxLen + 2, 8), 50) }
  })
  ws['!cols'] = colWidths
}
