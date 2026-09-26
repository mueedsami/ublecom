import ExcelJS from 'exceljs'
import { DhFlag, DhFlagsSummary, DhFlagSeverity, DhFlagType } from '@/lib/dhFlags'

export interface ExcelExportOptions {
  scopeName?: string
  dateStr?: string
  summary?: DhFlagsSummary | null
  filters?: {
    severity?: string
    flagType?: string
    status?: string
    store?: string
    search?: string
  }
}

const TYPE_LABELS: Record<string, string> = {
  stockout_risk: 'Stockout Risk',
  distribution_imbalance: 'Distribution Imbalance',
  dc_stuck: 'DC-Stuck Stock',
  dead_stock: 'Dead Stock',
  sales_decline: 'Sales Decline',
  store_health: 'Store Health',
}

const SEVERITY_COLORS = {
  critical: { fill: 'FEE2E2', text: '991B1B' }, // pale red
  warning: { fill: 'FEF3C7', text: '92400E' },  // pale amber
  info: { fill: 'E0F2FE', text: '075985' },     // pale blue
}

/**
 * Generates a clean, flat, highly functional Excel workbook from DH flags.
 * Includes full metric column unpacking and a styled Summary tab.
 */
export async function toExcelWorkbook(
  flags: DhFlag[],
  options: ExcelExportOptions = {}
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Pandamart DH Command Center'
  workbook.lastModifiedBy = 'Pandamart DH Operational Engine'
  workbook.created = new Date()
  workbook.modified = new Date()

  // -------------------------------------------------------------
  // TAB 1: Flags Worksheet (Clean, Flat, "White Page" Readable)
  // -------------------------------------------------------------
  const ws = workbook.addWorksheet('Operational Flags', {
    pageSetup: { orientation: 'landscape', paperSize: 9 }, // A4
  })

  // Columns definition: one column per unpacked metric
  ws.columns = [
    { header: 'Severity', key: 'severity', width: 14 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Flag Type', key: 'flag_type', width: 24 },
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'Product Name', key: 'product_name', width: 38 },
    { header: 'Brand', key: 'brand', width: 18 },
    { header: 'Store / Scope', key: 'store', width: 22 },
    { header: 'Days of Cover', key: 'days_of_cover', width: 14 },
    { header: 'Total Stock', key: 'total_stock', width: 13 },
    { header: 'Sold 30d', key: 'sold_qty_30d', width: 13 },
    { header: 'DC Stock', key: 'dc_qty', width: 12 },
    { header: 'Branch Stock', key: 'branch_qty', width: 13 },
    { header: 'Stores In-Stock', key: 'store_count_instock', width: 15 },
    { header: 'Drop %', key: 'drop_pct', width: 12 },
    { header: 'Prior 15d', key: 'prior_15d', width: 12 },
    { header: 'Recent 15d', key: 'recent_15d', width: 12 },
    { header: 'Store OOS %', key: 'oos_pct', width: 13 },
    { header: 'Store Dry SKUs', key: 'zero_count', width: 14 },
    { header: 'First Detected', key: 'first_detected_at', width: 18 },
    { header: 'Last Seen', key: 'last_seen_at', width: 18 },
    { header: 'Diagnostic Analysis & Root Cause', key: 'message', width: 60 },
  ]

  // Header Row (Row 1): bold, light-gray fill, frozen, autofiltered
  const headerRow = ws.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }, // light-gray fill
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  })

  // Specific left alignment for text columns in header
  ;['sku', 'product_name', 'brand', 'store', 'message'].forEach((key) => {
    const col = ws.getColumn(key)
    if (col && col.number) {
      ws.getCell(1, col.number).alignment = { vertical: 'middle', horizontal: 'left' }
    }
  })

  // Frozen header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Autofilter for all columns
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columns.length },
  }

  // Populate data rows
  for (const flag of flags) {
    const m = flag.metrics || {}
    const sku = flag.item?.dh_sku || m.dh_sku || ''
    const productName = flag.item?.dh_name || flag.item?.basepacks?.name || flag.title || ''
    const brand = flag.item?.basepacks?.brand || ''
    const store =
      flag.store?.display_name ||
      (flag.dh_store_id ? `Store ID: ${flag.dh_store_id}` : 'Network-Wide (17 Dark Stores + DC)')

    const firstSeen = flag.first_detected_at
      ? flag.first_detected_at.replace('T', ' ').slice(0, 16)
      : ''
    const lastSeen = flag.last_seen_at
      ? flag.last_seen_at.replace('T', ' ').slice(0, 16)
      : ''

    const row = ws.addRow({
      severity: (flag.severity || 'info').toUpperCase(),
      status: (flag.status || 'open').toUpperCase(),
      flag_type: TYPE_LABELS[flag.flag_type] || flag.flag_type,
      sku,
      product_name: productName,
      brand,
      store,
      days_of_cover: m.days_of_cover != null ? Number(m.days_of_cover) : null,
      total_stock: m.total_stock != null ? Number(m.total_stock) : null,
      sold_qty_30d: m.sold_qty_30d != null ? Number(m.sold_qty_30d) : null,
      dc_qty: m.dc_qty != null ? Number(m.dc_qty) : null,
      branch_qty: m.branch_qty != null ? Number(m.branch_qty) : null,
      store_count_instock: m.store_count_instock != null ? `${m.store_count_instock} of 16` : null,
      drop_pct: m.drop_pct != null ? `${m.drop_pct}%` : null,
      prior_15d: m.prior_15d != null ? Number(m.prior_15d) : null,
      recent_15d: m.recent_15d != null ? Number(m.recent_15d) : null,
      oos_pct: m.oos_pct != null ? `${m.oos_pct}%` : null,
      zero_count: m.zero_count != null ? Number(m.zero_count) : null,
      first_detected_at: firstSeen,
      last_seen_at: lastSeen,
      message: flag.message || '',
    })

    row.height = 22

    // Apply borders and font defaults
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })

    // Severity column: light conditional fill (pale red / pale amber / pale blue)
    const sevCell = row.getCell('severity')
    const sevKey = (flag.severity || 'info').toLowerCase() as DhFlagSeverity
    const sevColor = SEVERITY_COLORS[sevKey] || SEVERITY_COLORS.info

    sevCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${sevColor.fill}` },
    }
    sevCell.font = {
      name: 'Segoe UI',
      size: 9.5,
      bold: true,
      color: { argb: `FF${sevColor.text}` },
    }
    sevCell.alignment = { vertical: 'middle', horizontal: 'center' }

    // Status column: restrained pill-like font styling
    const statCell = row.getCell('status')
    const statKey = (flag.status || 'open').toLowerCase()
    statCell.alignment = { vertical: 'middle', horizontal: 'center' }
    if (statKey === 'resolved') {
      statCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }
      statCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF166534' } }
    } else if (statKey === 'acknowledged') {
      statCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      statCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFB45309' } }
    } else {
      statCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } }
    }

    // Number formats & alignments
    const numCols = ['total_stock', 'sold_qty_30d', 'dc_qty', 'branch_qty', 'prior_15d', 'recent_15d', 'zero_count']
    numCols.forEach((colKey) => {
      const c = row.getCell(colKey)
      if (c.value != null && typeof c.value === 'number') {
        c.numFmt = '#,##0'
        c.alignment = { vertical: 'middle', horizontal: 'right' }
      }
    })

    const docCell = row.getCell('days_of_cover')
    if (docCell.value != null && typeof docCell.value === 'number') {
      docCell.numFmt = '0.0'
      docCell.alignment = { vertical: 'middle', horizontal: 'right' }
    }

    ;['store_count_instock', 'drop_pct', 'oos_pct', 'first_detected_at', 'last_seen_at'].forEach((colKey) => {
      row.getCell(colKey).alignment = { vertical: 'middle', horizontal: 'center' }
    })
  }

  // -------------------------------------------------------------
  // TAB 2: Summary Worksheet
  // -------------------------------------------------------------
  const summaryWs = workbook.addWorksheet('Summary')
  summaryWs.views = [{ showGridLines: true }]

  // Widths for summary worksheet
  summaryWs.getColumn('A').width = 4
  summaryWs.getColumn('B').width = 28
  summaryWs.getColumn('C').width = 16
  summaryWs.getColumn('D').width = 18
  summaryWs.getColumn('E').width = 28

  // Header Title
  const titleRow = summaryWs.getRow(2)
  titleRow.getCell('B').value = 'Pandamart DH Command Center — Operational Flags Summary'
  titleRow.getCell('B').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } }

  const subRow = summaryWs.getRow(3)
  const todayStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  subRow.getCell('B').value = `Export Scope: ${options.scopeName || 'All Filters'}  ·  Export Date: ${todayStr}  ·  Total Rows: ${flags.length}`
  subRow.getCell('B').font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } }

  // Section 1: Severity Table
  let curRowIdx = 5
  const sevHeader = summaryWs.getRow(curRowIdx)
  sevHeader.getCell('B').value = 'Severity Level'
  sevHeader.getCell('C').value = 'Count'
  sevHeader.getCell('D').value = '% of Total'
  ;['B', 'C', 'D'].forEach((col) => {
    const c = sevHeader.getCell(col)
    c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    c.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'right' }
    c.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } }
  })
  sevHeader.height = 24

  const critCount = flags.filter((f) => f.severity === 'critical').length
  const warnCount = flags.filter((f) => f.severity === 'warning').length
  const infoCount = flags.filter((f) => f.severity === 'info').length
  const totalCount = flags.length || 1

  const sevData = [
    { label: 'Critical Action Required', count: critCount, color: 'FF991B1B', bg: 'FFFEE2E2' },
    { label: 'Warning Attention', count: warnCount, color: 'FF92400E', bg: 'FFFEF3C7' },
    { label: 'Catalog / Info', count: infoCount, color: 'FF075985', bg: 'FFE0F2FE' },
  ]

  for (const s of sevData) {
    curRowIdx++
    const r = summaryWs.getRow(curRowIdx)
    r.height = 20
    const bCell = r.getCell('B')
    bCell.value = s.label
    bCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: s.color } }
    bCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }

    const cCell = r.getCell('C')
    cCell.value = s.count
    cCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } }
    cCell.alignment = { vertical: 'middle', horizontal: 'right' }
    cCell.numFmt = '#,##0'

    const dCell = r.getCell('D')
    dCell.value = totalCount > 0 ? `${Math.round((s.count / totalCount) * 100)}%` : '0%'
    dCell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF475569' } }
    dCell.alignment = { vertical: 'middle', horizontal: 'right' }

    ;['B', 'C', 'D'].forEach((col) => {
      r.getCell(col).border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  }

  // Total Row
  curRowIdx++
  const totRow = summaryWs.getRow(curRowIdx)
  totRow.height = 22
  totRow.getCell('B').value = 'Total Flags in Export'
  totRow.getCell('B').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } }
  totRow.getCell('C').value = flags.length
  totRow.getCell('C').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } }
  totRow.getCell('C').alignment = { vertical: 'middle', horizontal: 'right' }
  totRow.getCell('C').numFmt = '#,##0'
  totRow.getCell('D').value = '100%'
  totRow.getCell('D').font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } }
  totRow.getCell('D').alignment = { vertical: 'middle', horizontal: 'right' }
  ;['B', 'C', 'D'].forEach((col) => {
    totRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    totRow.getCell(col).border = {
      top: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  })

  // Section 2: Flag Type Table
  curRowIdx += 3
  const typeHeader = summaryWs.getRow(curRowIdx)
  typeHeader.getCell('B').value = 'Operational Flag Type'
  typeHeader.getCell('C').value = 'Active Count'
  typeHeader.getCell('D').value = '% of Total'
  ;['B', 'C', 'D'].forEach((col) => {
    const c = typeHeader.getCell(col)
    c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
    c.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'right' }
    c.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } }
  })
  typeHeader.height = 24

  const flagTypeCounts: Record<string, number> = {}
  for (const f of flags) {
    flagTypeCounts[f.flag_type] = (flagTypeCounts[f.flag_type] || 0) + 1
  }

  const typeEntries = Object.entries(TYPE_LABELS)
  for (const [tKey, tLabel] of typeEntries) {
    const count = flagTypeCounts[tKey] || 0
    curRowIdx++
    const r = summaryWs.getRow(curRowIdx)
    r.height = 20
    const b = r.getCell('B')
    b.value = tLabel
    b.font = { name: 'Segoe UI', size: 9.5, bold: count > 0, color: { argb: count > 0 ? 'FF0F172A' : 'FF94A3B8' } }

    const c = r.getCell('C')
    c.value = count
    c.font = { name: 'Segoe UI', size: 9.5, bold: count > 0, color: { argb: count > 0 ? 'FF0F172A' : 'FF94A3B8' } }
    c.alignment = { vertical: 'middle', horizontal: 'right' }
    c.numFmt = '#,##0'

    const d = r.getCell('D')
    d.value = totalCount > 0 && count > 0 ? `${Math.round((count / totalCount) * 100)}%` : '0%'
    d.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } }
    d.alignment = { vertical: 'middle', horizontal: 'right' }

    ;['B', 'C', 'D'].forEach((col) => {
      r.getCell(col).border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  }

  // Section 3: Active Filters Audit Box
  curRowIdx += 3
  const filterHeader = summaryWs.getRow(curRowIdx)
  filterHeader.getCell('B').value = 'Filter Parameter'
  filterHeader.getCell('C').value = 'Filter Setting'
  summaryWs.mergeCells(curRowIdx, 3, curRowIdx, 4)
  ;['B', 'C', 'D'].forEach((col) => {
    const c = filterHeader.getCell(col)
    c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }
    c.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  filterHeader.height = 22

  const activeFilters = [
    { name: 'Severity Filter', val: options.filters?.severity?.toUpperCase() || 'ALL' },
    { name: 'Flag Type Filter', val: (options.filters?.flagType && TYPE_LABELS[options.filters.flagType]) || 'ALL' },
    { name: 'Status Filter', val: options.filters?.status?.toUpperCase() || 'OPEN' },
    { name: 'Store / Scope', val: options.filters?.store || 'All 17 Stores + Central DC' },
    { name: 'Search Query', val: options.filters?.search || 'None (Full catalog)' },
  ]

  for (const f of activeFilters) {
    curRowIdx++
    const r = summaryWs.getRow(curRowIdx)
    r.height = 20
    r.getCell('B').value = f.name
    r.getCell('B').font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF334155' } }
    r.getCell('C').value = f.val
    r.getCell('C').font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } }
    summaryWs.mergeCells(curRowIdx, 3, curRowIdx, 4)
    ;['B', 'C', 'D'].forEach((col) => {
      r.getCell(col).border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  }

  return workbook
}
