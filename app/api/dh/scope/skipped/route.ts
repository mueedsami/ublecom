import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { getInScopePandamartSkus, checkDhScopeSchemaInstalled } from '@/lib/dhScope'

export const dynamic = 'force-dynamic'

function computeWordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean))
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let common = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) common++
  }
  return (2 * common) / (wordsA.size + wordsB.size)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const exportFormat = searchParams.get('format') // 'xlsx' or null
    const filterDismissed = searchParams.get('dismissed') // 'all' | 'active' | 'dismissed'

    const supabase = getAdminClient()
    const scope = await getInScopePandamartSkus(supabase)
    const is014Installed = await checkDhScopeSchemaInstalled(supabase)

    // 1. Fetch ignored/skipped items from dh_items
    let query = supabase
      .from('dh_items')
      .select('id,dh_sku,dh_name,match_status,basepack_id,created_at')
      .eq('match_status', 'ignored')

    const { data: rawIgnored, error: itemsErr } = await query
    if (itemsErr) throw itemsErr

    // If 014 columns are installed, fetch them too
    let extraStatsMap = new Map<string, { last_seen_date: string | null; skip_stats: any; dismissed: boolean }>()
    if (is014Installed) {
      const { data: statsData } = await supabase
        .from('dh_items')
        .select('id,last_seen_date,skip_stats,dismissed')
        .eq('match_status', 'ignored')

      for (const r of statsData || []) {
        extraStatsMap.set(r.id, {
          last_seen_date: r.last_seen_date,
          skip_stats: r.skip_stats || {},
          dismissed: Boolean(r.dismissed),
        })
      }
    }

    // 2. Fetch basepacks for suggestion matching
    const { data: basepacks } = await supabase
      .from('basepacks')
      .select('id,name,brand,category')
      .eq('active', true)

    const bpList = basepacks || []

    // 3. Build skipped items list with suggested matches
    const skippedItems = (rawIgnored || []).map(item => {
      const extra = extraStatsMap.get(item.id) || { last_seen_date: null, skip_stats: {}, dismissed: false }
      const stats = extra.skip_stats || {}

      // Find top suggested basepack match
      let bestBp: any = null
      let bestScore = 0
      for (const bp of bpList) {
        const score = computeWordOverlap(item.dh_name, bp.name)
        if (score > bestScore && score >= 0.35) {
          bestScore = score
          bestBp = bp
        }
      }

      return {
        id: item.id,
        dh_sku: item.dh_sku,
        dh_name: item.dh_name,
        sold_qty_30d: stats.sold_qty_30d || 0,
        total_stock: stats.total_stock || 0,
        last_sale_date: stats.last_sale_date || null,
        last_seen_date: extra.last_seen_date || null,
        dismissed: extra.dismissed,
        suggested_basepack: bestBp
          ? {
              id: bestBp.id,
              name: bestBp.name,
              brand: bestBp.brand,
              confidence: Math.round(bestScore * 100),
            }
          : null,
      }
    })

    // Sort descending by 30-day sold qty so top selling products stand out
    skippedItems.sort((a, b) => b.sold_qty_30d - a.sold_qty_30d)

    // Filter by dismissed status if requested
    let filteredSkipped = skippedItems
    if (filterDismissed === 'dismissed') {
      filteredSkipped = skippedItems.filter(it => it.dismissed)
    } else if (filterDismissed === 'active' || !filterDismissed) {
      filteredSkipped = skippedItems.filter(it => !it.dismissed)
    }

    // 4. Reverse analysis: List SKUs missing from dump
    const { data: matchedDhItems } = await supabase
      .from('dh_items')
      .select('dh_sku')
      .eq('match_status', 'matched')

    const matchedSkusSet = new Set((matchedDhItems || []).map(r => r.dh_sku))
    const missingFromDump: Array<{
      sku: string
      basepack_id: string
      basepack_name: string
      brand: string | null
      product_name: string | null
      branches_count: number
    }> = []

    for (const [sku, info] of scope.skuMap.entries()) {
      if (!matchedSkusSet.has(sku)) {
        missingFromDump.push({
          sku,
          basepack_id: info.basepack_id,
          basepack_name: info.basepack_name,
          brand: info.brand,
          product_name: info.product_name,
          branches_count: info.locations.length,
        })
      }
    }

    // 5. Excel Export if requested
    if (exportFormat === 'xlsx') {
      const wb = XLSX.utils.book_new()
      const exportRows = filteredSkipped.map(it => ({
        'Item ID (SKU)': it.dh_sku,
        'Item Name': it.dh_name,
        '30-Day Sold Qty': it.sold_qty_30d,
        'Total Current Stock': it.total_stock,
        'Last Seen Date': it.last_seen_date || '',
        'Suggested Basepack': it.suggested_basepack?.name || 'No match',
        'Suggestion Confidence': it.suggested_basepack ? `${it.suggested_basepack.confidence}%` : '',
        'Status': it.dismissed ? 'Dismissed' : 'Skipped',
      }))
      const ws = XLSX.utils.json_to_sheet(exportRows)
      XLSX.utils.book_append_sheet(wb, ws, 'Skipped SKUs')

      const missingRows = missingFromDump.map(it => ({
        'Item ID (SKU)': it.sku,
        'Basepack': it.basepack_name,
        'Brand': it.brand || '',
        'Product Name': it.product_name || '',
        'Branches Listed': it.branches_count,
        'Status': 'Missing from Dump',
      }))
      const wsMissing = XLSX.utils.json_to_sheet(missingRows)
      XLSX.utils.book_append_sheet(wb, wsMissing, 'Missing from Dump')

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="DH_Skipped_SKUs_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      total_skipped: skippedItems.length,
      filtered_skipped_count: filteredSkipped.length,
      missing_from_dump_count: missingFromDump.length,
      is_014_installed: is014Installed,
      skipped_items: filteredSkipped,
      missing_from_dump: missingFromDump,
    })
  } catch (err: any) {
    console.error('Error fetching skipped SKUs:', err)
    return NextResponse.json({ error: err.message || 'Failed to list skipped SKUs' }, { status: 500 })
  }
}

// POST: Toggle dismissed status for a skipped SKU
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dh_item_id, dismissed } = body

    if (!dh_item_id) {
      return NextResponse.json({ error: 'dh_item_id is required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const is014Installed = await checkDhScopeSchemaInstalled(supabase)

    if (!is014Installed) {
      return NextResponse.json({
        success: true,
        message: 'Schema migration 014 is pending; dismissed state saved in session.',
      })
    }

    const { error: updErr } = await supabase
      .from('dh_items')
      .update({
        dismissed: Boolean(dismissed),
        updated_at: new Date().toISOString(),
      })
      .eq('id', dh_item_id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      dh_item_id,
      dismissed: Boolean(dismissed),
    })
  } catch (err: any) {
    console.error('Error updating dismissed status:', err)
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 })
  }
}
