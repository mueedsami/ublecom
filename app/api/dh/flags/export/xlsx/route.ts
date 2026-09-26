import { NextRequest, NextResponse } from 'next/server'
import { getDhFlags, DhFlagSeverity, DhFlagStatus, DhFlagType } from '@/lib/dhFlags'
import { toExcelWorkbook, buildExportFilename } from '@/lib/dhExport'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const severity = (searchParams.get('severity') as DhFlagSeverity | 'all') || 'all'
    const flagType =
      (searchParams.get('type') as DhFlagType | 'all') ||
      (searchParams.get('flag_type') as DhFlagType | 'all') ||
      'all'
    const status = (searchParams.get('status') as DhFlagStatus | 'all') || 'all'
    const store = searchParams.get('store') || undefined
    const search = searchParams.get('q') || searchParams.get('search') || undefined

    // 1. Fetch matching flags using the same query engine as the table
    const result = await getDhFlags({
      severity,
      flagType,
      status,
      store,
      search,
    })

    // 2. Build human-readable scope label
    const scopeParts: string[] = []
    if (severity !== 'all') scopeParts.push(`${severity.toUpperCase()} Severity`)
    if (flagType !== 'all') scopeParts.push(flagType.replace(/_/g, ' ').toUpperCase())
    if (store) scopeParts.push(`Store: ${store}`)
    if (status !== 'all' && status !== 'open') scopeParts.push(`Status: ${status.toUpperCase()}`)
    const scopeName = scopeParts.length > 0 ? scopeParts.join(' · ') : 'All Active Flags'

    // 3. Generate Exceljs workbook
    const workbook = await toExcelWorkbook(result.flags, {
      scopeName,
      summary: result.summary,
      filters: {
        severity,
        flagType,
        status,
        store,
        search,
      },
    })

    // 4. Serialize to buffer
    const buffer = await workbook.xlsx.writeBuffer()
    const filename = buildExportFilename('xlsx', {
      severity,
      flagType,
      status,
      store,
    })

    return new NextResponse(new Uint8Array(Buffer.from(buffer)), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err: any) {
    console.error('DH Flags Excel export error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to export DH flags to Excel' },
      { status: 500 }
    )
  }
}
