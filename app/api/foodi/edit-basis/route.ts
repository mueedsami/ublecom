import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function computeAsOfDate(fileDateStr: string, basis: 'same_day' | 'previous_day'): string {
  const parts = fileDateStr.split('-').map(Number)
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  if (basis === 'previous_day') {
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { uploadId, newBasis } = body

    if (!uploadId || !newBasis) {
      return NextResponse.json({ success: false, error: 'uploadId and newBasis are required' }, { status: 400 })
    }

    if (newBasis !== 'same_day' && newBasis !== 'previous_day') {
      return NextResponse.json({ success: false, error: 'newBasis must be either "same_day" or "previous_day"' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Fetch upload
    const { data: upload, error: upErr } = await supabase
      .from('marketplace_report_uploads')
      .select('id, account_id, report_date, stock_basis, stock_as_of, file_name')
      .eq('id', uploadId)
      .single()

    if (upErr || !upload) {
      return NextResponse.json({ success: false, error: 'Upload record not found' }, { status: 404 })
    }

    const fileDate = upload.report_date
    const newAsOfDate = computeAsOfDate(fileDate, newBasis)

    // 2. Collision Check: Does another upload for this account already use newAsOfDate?
    const { data: collisions } = await supabase
      .from('marketplace_report_uploads')
      .select('id, file_name, stock_as_of, report_date')
      .eq('account_id', upload.account_id)
      .neq('id', uploadId)
      .or(`stock_as_of.eq.${newAsOfDate},and(stock_as_of.is.null,report_date.eq.${newAsOfDate})`)

    if (collisions && collisions.length > 0) {
      const collidingFile = collisions[0].file_name
      return NextResponse.json({
        success: false,
        collision: true,
        error: `Collision detected: Another upload (${collidingFile}) already occupies as-of date ${newAsOfDate}. Move or delete that snapshot first to avoid conflicts.`,
      }, { status: 409 })
    }

    // 3. Compute 30-day window
    const asOfUtc = new Date(newAsOfDate + 'T00:00:00Z')
    const startUtc = new Date(asOfUtc)
    startUtc.setUTCDate(startUtc.getUTCDate() - 29)
    const newPeriodStart = startUtc.toISOString().slice(0, 10)
    const newPeriodEnd = newAsOfDate

    // 4. Update upload record
    const { error: updateUpErr } = await supabase
      .from('marketplace_report_uploads')
      .update({
        stock_basis: newBasis,
        stock_as_of: newAsOfDate,
      })
      .eq('id', uploadId)

    if (updateUpErr) {
      console.error('Error updating marketplace_report_uploads:', updateUpErr)
    }

    // 5. Update stock snapshots
    const { error: stockUpErr } = await supabase
      .from('marketplace_stock_snapshots')
      .update({ snapshot_date: newAsOfDate })
      .eq('upload_id', uploadId)

    if (stockUpErr) {
      console.error('Error updating marketplace_stock_snapshots:', stockUpErr)
    }

    // 6. Update sales periods
    const { error: salesUpErr } = await supabase
      .from('marketplace_sales_periods')
      .update({
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
      })
      .eq('upload_id', uploadId)

    if (salesUpErr) {
      console.error('Error updating marketplace_sales_periods:', salesUpErr)
    }

    return NextResponse.json({
      success: true,
      uploadId,
      fileDate,
      newBasis,
      newAsOfDate,
      message: `Stock basis successfully changed to ${newBasis === 'same_day' ? 'Same day' : 'Previous day (T-1)'}. Snapshot is now as of ${newAsOfDate}.`,
    })
  } catch (err: any) {
    console.error('Edit basis error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error while editing stock basis',
    }, { status: 500 })
  }
}
