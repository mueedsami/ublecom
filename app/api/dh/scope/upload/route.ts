import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { getInScopePandamartSkus, syncDhItemsScope } from '@/lib/dhScope'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function cleanText(v: any): string {
  if (v == null) return ''
  return String(v).trim().replace(/\s+/g, ' ')
}

function findCol(keys: string[], candidates: string[]): string | undefined {
  for (const c of candidates) {
    const match = keys.find(k => k.toLowerCase().trim() === c.toLowerCase().trim())
    if (match) return match
  }
  for (const c of candidates) {
    const match = keys.find(k => k.toLowerCase().includes(c.toLowerCase()))
    if (match) return match
  }
  return undefined
}

// GET: Download current list in standard Pandamart branch-sheet layout
export async function GET() {
  try {
    const supabase = getAdminClient()
    const scope = await getInScopePandamartSkus(supabase)

    const { data: pandamartAcc } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', 'pandamart')
      .single()

    if (!pandamartAcc) {
      return NextResponse.json({ error: 'Pandamart account not found' }, { status: 500 })
    }

    // Fetch all account_products for pandamart with location and basepack info
    const { data: aps } = await supabase
      .from('account_products')
      .select(`
        account_sku,
        product_name,
        active,
        locations(id,name,code),
        basepacks(id,name,brand,category,format,business_unit)
      `)
      .eq('account_id', pandamartAcc.id)
      .eq('active', true)

    const wb = XLSX.utils.book_new()
    const branchMap = new Map<string, any[]>()

    for (const r of (aps as any[]) || []) {
      const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations
      const bp = Array.isArray(r.basepacks) ? r.basepacks[0] : r.basepacks
      const branchName = loc?.name || 'All'
      if (!branchMap.has(branchName)) branchMap.set(branchName, [])
      branchMap.get(branchName)!.push({
        Basepack: bp?.name || '',
        'BUSINESS UNIT': bp?.business_unit || '',
        Category: bp?.category || '',
        Format: bp?.format || '',
        Brand: bp?.brand || '',
        [`Delivery Hero Stores (Bangladesh) Limited-${branchName}`]: r.account_sku,
        Item_Name: r.product_name || '',
        Status: 'Active',
      })
    }

    // Ensure all 11 locations are added as sheets
    for (const loc of scope.locations) {
      const rows = branchMap.get(loc.name) || []
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, loc.name.slice(0, 31))
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Pandamart_SKU_List_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (err: any) {
    console.error('Error exporting Pandamart SKU list:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Preview diff or Apply upload
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const action = (formData.get('action') as string) || 'preview' // 'preview' | 'apply'
    const mode = (formData.get('mode') as string) || 'merge' // 'merge' | 'replace'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const supabase = getAdminClient()

    // 1. Fetch metadata (Pandamart account, basepacks, locations)
    const [{ data: pandamartAcc }, { data: basepacks }, { data: locations }] = await Promise.all([
      supabase.from('accounts').select('id').eq('code', 'pandamart').single(),
      supabase.from('basepacks').select('id,name'),
      supabase.from('locations').select('id,name,code,account_id').eq('active', true),
    ])

    if (!pandamartAcc) {
      return NextResponse.json({ error: 'Pandamart account not found' }, { status: 500 })
    }

    const pmLocations = (locations || []).filter(l => l.account_id === pandamartAcc.id)
    const locByName = new Map<string, string>()
    for (const l of pmLocations) {
      locByName.set(cleanText(l.name).toLowerCase(), l.id)
      locByName.set(cleanText(l.code).toLowerCase(), l.id)
    }

    const bpByName = new Map<string, string>(
      (basepacks || []).map(b => [cleanText(b.name).toLowerCase(), b.id])
    )

    // Current active account_products in DB
    const scope = await getInScopePandamartSkus(supabase)
    const existingSkusInDb = scope.skuMap

    // 2. Parse workbook sheets
    const parsedRows: Array<{
      sheet: string
      location_id: string | null
      sku: string
      basepack_name: string
      basepack_id: string | null
      product_name: string | null
    }> = []

    const unknownBasepacks = new Set<string>()
    const unknownSheets: string[] = []
    let blankSkuRows = 0
    const fileSkusSet = new Set<string>()

    for (const sheet of workbook.SheetNames) {
      const cleanSheet = cleanText(sheet)
      const locId = locByName.get(cleanSheet.toLowerCase()) || null
      if (!locId) {
        unknownSheets.push(sheet)
      }

      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheet])
      if (rows.length === 0) continue

      const firstRow = rows[0]
      const colKeys = Object.keys(firstRow)

      const baseCol = findCol(colKeys, ['Basepack', 'Base Pack', 'Base_Pack', 'Mother Product']) || 'Basepack'
      const nameCol = findCol(colKeys, ['Item_Name', 'Item Name', 'Product Name', 'Account Product Name', 'Name'])
      const skuCol = findCol(colKeys, [
        `Delivery Hero Stores (Bangladesh) Limited-${sheet}`,
        `Delivery Hero Stores Bangladesh Limited ${sheet}`,
        'Delivery Hero Stores',
        'Item_Id',
        'Item ID',
        'Account SKU',
        'SKU',
      ]) || colKeys.find(k => k.toLowerCase().includes('delivery hero') || k.toLowerCase().includes('item_id'))

      for (const r of rows) {
        const bpName = cleanText(r[baseCol])
        const rawSku = skuCol ? cleanText(r[skuCol]) : ''
        const pName = nameCol ? cleanText(r[nameCol]) : ''

        if (!rawSku) {
          blankSkuRows++
          continue
        }

        fileSkusSet.add(rawSku)
        const bpId = bpByName.get(bpName.toLowerCase()) || null
        if (!bpId && bpName) {
          unknownBasepacks.add(bpName)
        }

        parsedRows.push({
          sheet,
          location_id: locId,
          sku: rawSku,
          basepack_name: bpName,
          basepack_id: bpId,
          product_name: pName || null,
        })
      }
    }

    // 3. Compute Diff
    const toAddSkus = new Set<string>()
    const toUpdateSkus = new Set<string>()
    const toDeactivateSkus = new Set<string>()

    for (const parsed of parsedRows) {
      const existing = existingSkusInDb.get(parsed.sku)
      if (!existing) {
        toAddSkus.add(parsed.sku)
      } else if (
        (parsed.basepack_id && existing.basepack_id !== parsed.basepack_id) ||
        (parsed.product_name && existing.product_name !== parsed.product_name)
      ) {
        toUpdateSkus.add(parsed.sku)
      }
    }

    // In replace mode, any active SKU in DB that is not present in the uploaded file is deactivated
    if (mode === 'replace') {
      for (const [dbSku] of existingSkusInDb.entries()) {
        if (!fileSkusSet.has(dbSku)) {
          toDeactivateSkus.add(dbSku)
        }
      }
    }

    // If PREVIEW action, return diff preview
    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        preview: {
          total_sheets: workbook.SheetNames.length,
          sheets: workbook.SheetNames,
          total_file_skus: fileSkusSet.size,
          to_add_count: toAddSkus.size,
          to_add_sample: Array.from(toAddSkus).slice(0, 10),
          to_update_count: toUpdateSkus.size,
          to_update_sample: Array.from(toUpdateSkus).slice(0, 10),
          to_deactivate_count: toDeactivateSkus.size,
          to_deactivate_sample: Array.from(toDeactivateSkus).slice(0, 10),
          unknown_basepacks_count: unknownBasepacks.size,
          unknown_basepacks_sample: Array.from(unknownBasepacks).slice(0, 10),
          unknown_sheets: unknownSheets,
          blank_sku_rows: blankSkuRows,
          mode,
        },
      })
    }

    // APPLY action: persist to account_products
    const validRowsToUpsert = parsedRows.filter(r => r.sku && r.basepack_id)
    if (validRowsToUpsert.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows with recognized basepacks found to apply.' },
        { status: 400 }
      )
    }

    const payload = validRowsToUpsert.map(r => ({
      account_id: pandamartAcc.id,
      location_id: r.location_id,
      account_sku: r.sku,
      basepack_id: r.basepack_id,
      product_name: r.product_name,
      active: true,
      scrape_enabled: false,
    }))

    // Deduplicate conflict keys: (account_id, location_id, account_sku, basepack_id)
    const dedupMap = new Map<string, any>()
    for (const p of payload) {
      const key = `${p.account_id}|${p.location_id || 'null'}|${p.account_sku}|${p.basepack_id}`
      dedupMap.set(key, p)
    }
    const dedupedPayload = Array.from(dedupMap.values())

    // Batch upsert into account_products
    let appliedCount = 0
    for (let i = 0; i < dedupedPayload.length; i += 100) {
      const batch = dedupedPayload.slice(i, i + 100)
      const { error: upErr } = await supabase
        .from('account_products')
        .upsert(batch, { onConflict: 'account_id,location_id,account_sku,basepack_id' })
      if (upErr) throw upErr
      appliedCount += batch.length
    }

    // If replace mode, deactivate missing SKUs
    let deactivatedCount = 0
    if (mode === 'replace' && toDeactivateSkus.size > 0) {
      const toDeactArray = Array.from(toDeactivateSkus)
      for (let i = 0; i < toDeactArray.length; i += 100) {
        const batch = toDeactArray.slice(i, i + 100)
        await supabase
          .from('account_products')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('account_id', pandamartAcc.id)
          .in('account_sku', batch)
        deactivatedCount += batch.length
      }
    }

    // Run instant scope sync to promote/demote dh_items and refresh open flags
    const syncRes = await syncDhItemsScope(supabase)

    return NextResponse.json({
      success: true,
      applied_rows: appliedCount,
      deactivated_skus: deactivatedCount,
      mode,
      scope_sync: syncRes,
    })
  } catch (err: any) {
    console.error('Error applying scope upload:', err)
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
  }
}
