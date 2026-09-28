import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getMarketplaceFlags } from '@/lib/marketplaceFlags'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get('account') || 'othoba'
    const severity = (searchParams.get('severity') as any) || 'all'
    const type = (searchParams.get('type') as any) || 'all'
    const status = (searchParams.get('status') as any) || 'all'

    const { flags, summary } = await getMarketplaceFlags(account, { severity, type, status })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'UBL Digital Shelf Command Center'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet(`${account.toUpperCase()} Flags`, {
      views: [{ showGridLines: true }],
    })

    // Header styling
    sheet.columns = [
      { header: 'Flag Type', key: 'flag_type', width: 22 },
      { header: 'Severity', key: 'severity', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Source ID', key: 'source_id', width: 14 },
      { header: 'Marketplace Product Name', key: 'item_name', width: 42 },
      { header: 'Basepack Linked', key: 'basepack_name', width: 32 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Current Stock', key: 'current_stock', width: 14 },
      { header: 'Sold Qty', key: 'sold_qty', width: 14 },
      { header: 'Run Rate (/day)', key: 'run_rate', width: 16 },
      { header: 'Days of Cover', key: 'days_of_cover', width: 16 },
      { header: 'Stock Value (৳)', key: 'stock_value', width: 16 },
      { header: 'Title', key: 'title', width: 36 },
      { header: 'Alert Message', key: 'message', width: 50 },
      { header: 'Report Date', key: 'report_date', width: 14 },
      { header: 'Detected At', key: 'detected_at', width: 18 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 28

    // Add rows
    for (const f of flags) {
      const row = sheet.addRow({
        flag_type: f.flag_type.replace(/_/g, ' ').toUpperCase(),
        severity: f.severity.toUpperCase(),
        status: f.status.toUpperCase(),
        sku: f.item?.sku || '',
        source_id: f.item?.source_product_id || '',
        item_name: f.item?.name || '',
        basepack_name: f.item?.basepacks?.name || 'Unmatched',
        brand: f.item?.basepacks?.brand || '',
        current_stock: f.metrics?.current_stock ?? f.item?.current_stock ?? 0,
        sold_qty: f.metrics?.sold_qty ?? f.item?.sold_qty ?? 0,
        run_rate: f.metrics?.run_rate ?? f.item?.run_rate ?? '',
        days_of_cover: f.metrics?.days_of_cover != null ? f.metrics.days_of_cover : '—',
        stock_value: f.metrics?.stock_value ? Math.round(f.metrics.stock_value) : '',
        title: f.title,
        message: f.message,
        report_date: f.report_date,
        detected_at: f.first_detected_at ? f.first_detected_at.slice(0, 10) : '',
      })

      // Severity highlight
      const sevCell = row.getCell('severity')
      if (f.severity === 'critical') {
        sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD2D2' } }
        sevCell.font = { bold: true, color: { argb: 'FFC53030' } }
      } else if (f.severity === 'warning') {
        sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEAA7' } }
        sevCell.font = { bold: true, color: { argb: 'FFD69E2E' } }
      }

      row.height = 22
      row.alignment = { vertical: 'middle' }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `${account}-flags_${severity}_${dateStr}.xlsx`

    return new NextResponse(new Uint8Array(Buffer.from(buffer)), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 })
  }
}
