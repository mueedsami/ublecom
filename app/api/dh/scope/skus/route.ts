import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { getInScopePandamartSkus, syncDhItemsScope } from '@/lib/dhScope'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminClient()
    const scope = await getInScopePandamartSkus(supabase)

    const { data: dhItems } = await supabase
      .from('dh_items')
      .select('id,dh_sku,dh_name,match_status,basepack_id')

    const dhItemBySku = new Map<string, any>((dhItems || []).map(it => [it.dh_sku, it]))

    const skusList = Array.from(scope.skuMap.values()).map(item => {
      const dhItem = dhItemBySku.get(item.sku)
      return {
        sku: item.sku,
        product_name: item.product_name,
        basepack_id: item.basepack_id,
        basepack_name: item.basepack_name,
        brand: item.brand,
        category: item.category,
        branches_count: item.locations.length,
        branches_total: scope.locations.length,
        locations: item.locations,
        active: item.active,
        scrape_enabled: item.scrape_enabled,
        dh_match_status: dhItem?.match_status || 'not_in_dump',
        dh_item_id: dhItem?.id || null,
      }
    })

    return NextResponse.json({
      success: true,
      total_skus: skusList.length,
      total_basepacks: scope.totalActiveBasepacks,
      total_locations: scope.locations.length,
      locations: scope.locations,
      skus: skusList,
    })
  } catch (err: any) {
    console.error('Error fetching scope SKUs:', err)
    return NextResponse.json({ error: err.message || 'Failed to list SKUs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { account_sku, basepack_id, location_ids, product_name, scrape_enabled } = body

    const cleanSku = (account_sku || '').trim()
    if (!cleanSku) {
      return NextResponse.json({ error: 'account_sku (Item_Id) is required' }, { status: 400 })
    }
    if (!basepack_id) {
      return NextResponse.json({ error: 'basepack_id is required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Get Pandamart account
    const { data: pandamartAcc, error: accErr } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', 'pandamart')
      .single()

    if (accErr || !pandamartAcc) {
      return NextResponse.json({ error: 'Pandamart account not found' }, { status: 500 })
    }

    // 2. Determine locations
    let targetLocationIds: string[] = []
    if (Array.isArray(location_ids) && location_ids.length > 0) {
      targetLocationIds = location_ids
    } else {
      const { data: locs } = await supabase
        .from('locations')
        .select('id')
        .eq('account_id', pandamartAcc.id)
        .eq('active', true)
      targetLocationIds = (locs || []).map(l => l.id)
    }

    if (targetLocationIds.length === 0) {
      targetLocationIds = [null as any]
    }

    // 3. Prepare payload for account_products
    const rows = targetLocationIds.map(locId => ({
      account_id: pandamartAcc.id,
      location_id: locId,
      account_sku: cleanSku,
      basepack_id: basepack_id,
      product_name: product_name ? product_name.trim() : null,
      active: true,
      scrape_enabled: scrape_enabled ?? false,
    }))

    const { error: upsertErr } = await supabase
      .from('account_products')
      .upsert(rows, { onConflict: 'account_id,location_id,account_sku,basepack_id' })

    if (upsertErr) {
      console.error('Error inserting account products:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    // 4. Trigger instant scope synchronization
    const syncRes = await syncDhItemsScope(supabase)

    return NextResponse.json({
      success: true,
      sku: cleanSku,
      locations_added: targetLocationIds.length,
      scope_sync: syncRes,
    })
  } catch (err: any) {
    console.error('Error adding SKU to scope:', err)
    return NextResponse.json({ error: err.message || 'Failed to add SKU' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { account_sku, basepack_id, product_name, active, scrape_enabled } = body

    const cleanSku = (account_sku || '').trim()
    if (!cleanSku) {
      return NextResponse.json({ error: 'account_sku is required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data: pandamartAcc } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', 'pandamart')
      .single()

    if (!pandamartAcc) {
      return NextResponse.json({ error: 'Pandamart account not found' }, { status: 500 })
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (basepack_id !== undefined) patch.basepack_id = basepack_id
    if (product_name !== undefined) patch.product_name = product_name ? product_name.trim() : null
    if (active !== undefined) patch.active = Boolean(active)
    if (scrape_enabled !== undefined) patch.scrape_enabled = Boolean(scrape_enabled)

    const { error: updErr } = await supabase
      .from('account_products')
      .update(patch)
      .eq('account_id', pandamartAcc.id)
      .eq('account_sku', cleanSku)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Trigger instant scope synchronization
    const syncRes = await syncDhItemsScope(supabase)

    return NextResponse.json({
      success: true,
      sku: cleanSku,
      scope_sync: syncRes,
    })
  } catch (err: any) {
    console.error('Error updating SKU scope:', err)
    return NextResponse.json({ error: err.message || 'Failed to update SKU' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sku = searchParams.get('sku')
    if (!sku) {
      return NextResponse.json({ error: 'sku query param required' }, { status: 400 })
    }

    const cleanSku = sku.trim()
    const supabase = getAdminClient()

    const { data: pandamartAcc } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', 'pandamart')
      .single()

    if (!pandamartAcc) {
      return NextResponse.json({ error: 'Pandamart account not found' }, { status: 500 })
    }

    // Deactivate across all branches (preserve history rule)
    const { error: updErr } = await supabase
      .from('account_products')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('account_id', pandamartAcc.id)
      .eq('account_sku', cleanSku)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Trigger scope sync to demote item to 'ignored' and resolve its open flags
    const syncRes = await syncDhItemsScope(supabase)

    return NextResponse.json({
      success: true,
      sku: cleanSku,
      scope_sync: syncRes,
    })
  } catch (err: any) {
    console.error('Error deleting SKU from scope:', err)
    return NextResponse.json({ error: err.message || 'Failed to remove SKU' }, { status: 500 })
  }
}
