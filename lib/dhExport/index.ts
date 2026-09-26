export * from './toExcelWorkbook'
export * from './toPdfBuffer'
export * from './flagsReportTemplate'

export interface ExportFilterParams {
  severity?: string
  flagType?: string
  status?: string
  store?: string
  search?: string
}

/**
 * Builds the canonical filename encoding scope and date per the plan:
 * e.g. dh-flags_critical_2026-09-27.xlsx
 *      dh-flags_sales-decline_2026-09-27.pdf
 *      dh-flags_all_2026-09-27.xlsx
 */
export function buildExportFilename(
  format: 'xlsx' | 'pdf',
  filters: ExportFilterParams
): string {
  const parts: string[] = ['dh-flags']

  const hasSeverity = filters.severity && filters.severity !== 'all'
  const hasType = filters.flagType && filters.flagType !== 'all'
  const hasStore = filters.store && filters.store.trim().length > 0
  const hasStatus = filters.status && filters.status !== 'all' && filters.status !== 'open'

  if (hasSeverity) {
    parts.push(filters.severity!.toLowerCase())
  }

  if (hasType) {
    parts.push(filters.flagType!.toLowerCase().replace(/_/g, '-'))
  }

  if (hasStore) {
    parts.push(
      filters.store!.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    )
  }

  if (hasStatus) {
    parts.push(filters.status!.toLowerCase())
  }

  if (parts.length === 1) {
    parts.push('all')
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  parts.push(dateStr)

  return `${parts.join('_')}.${format}`
}
