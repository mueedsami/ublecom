import { NextRequest, NextResponse } from 'next/server'
import { getDhFlags, DhFlagSeverity, DhFlagStatus, DhFlagType } from '@/lib/dhFlags'
import { toPdfBuffer, buildExportFilename } from '@/lib/dhExport'

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

    // 1. Fetch matching flags using the exact same query engine
    const result = await getDhFlags({
      severity,
      flagType,
      status,
      store,
      search,
    })

    // 2. Build human-readable scope label
    const scopeParts: string[] = []
    if (severity !== 'all') scopeParts.push(`${severity.toUpperCase()} Priority`)
    if (flagType !== 'all') scopeParts.push(flagType.replace(/_/g, ' ').toUpperCase())
    if (store) scopeParts.push(`Store: ${store}`)
    if (status !== 'all' && status !== 'open') scopeParts.push(`Status: ${status.toUpperCase()}`)
    const scopeName = scopeParts.length > 0 ? scopeParts.join(' · ') : 'All Operational Flags'

    // 3. Generate styled dark cyber PDF buffer
    const pdfBuffer = await toPdfBuffer(result.flags, {
      scopeName,
      filters: {
        severity,
        flagType,
        status,
        store,
        search,
      },
    })

    const filename = buildExportFilename('pdf', {
      severity,
      flagType,
      status,
      store,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err: any) {
    console.error('DH Flags PDF export error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to export DH flags to PDF' },
      { status: 500 }
    )
  }
}
