import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { calculateMargin, STANDARD_PLATFORMS, EnlistmentStatus } from '@/lib/enlistmentData'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  if (!url || !key) {
    throw new Error('Supabase URL or Key not configured.')
  }
  return createClient(url, key)
}

function cleanStr(v: any): string {
  if (v == null) return ''
  return String(v).trim()
}

function parseNum(v: any, fallback: number = 0): number {
  if (v == null || v === '') return fallback
  if (typeof v === 'number') return isNaN(v) ? fallback : v
  const clean = String(v).replace(/[^0-9.-]/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? fallback : Number(num.toFixed(2))
}

function parseIntNum(v: any, fallback: number = 0): number {
  if (v == null || v === '') return fallback
  if (typeof v === 'number') return isNaN(v) ? fallback : Math.round(v)
  const clean = String(v).replace(/[^0-9-]/g, '')
  const num = parseInt(clean, 10)
  return isNaN(num) ? fallback : num
}

function parsePlatformArray(v: any, fallback: string[] = []): string[] {
  if (!v) return fallback
  if (Array.isArray(v)) return v.map((s) => cleanStr(s)).filter(Boolean)
  const str = String(v).trim()
  if (!str) return fallback
  return str
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Normalize key for column discovery
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided in upload' }, { status: 400 })
    }

    const mode = (formData.get('mode') as string) || 'commit' // 'preview' | 'commit'
    const defaultTargetsRaw = formData.get('default_target_platforms') as string | null
    let defaultTargets: string[] = Array.from(STANDARD_PLATFORMS)
    if (defaultTargetsRaw) {
      try {
        const parsed = JSON.parse(defaultTargetsRaw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          defaultTargets = parsed
        }
      } catch {
        // fallback to standard
      }
    }

    const defaultStatusRaw = (formData.get('default_status') as string) || 'open'
    const defaultStatus: EnlistmentStatus = ['open', 'in_review', 'enlisted', 'paused'].includes(
      defaultStatusRaw
    )
      ? (defaultStatusRaw as EnlistmentStatus)
      : 'open'

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return NextResponse.json({ error: 'The uploaded spreadsheet is empty.' }, { status: 400 })
    }

    const sheet = workbook.Sheets[firstSheetName]
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in the uploaded sheet.' },
        { status: 400 }
      )
    }

    // Build column map from the first row keys
    const sample = rawRows[0]
    const keyMap = new Map<string, string>() // normalizedKey -> originalKey
    for (const k of Object.keys(sample)) {
      keyMap.set(normalizeKey(k), k)
    }

    function getVal(row: any, ...candidates: string[]): any {
      for (const cand of candidates) {
        const norm = normalizeKey(cand)
        const orig = keyMap.get(norm)
        if (orig && row[orig] !== undefined && row[orig] !== '') {
          return row[orig]
        }
      }
      return null
    }

    const supabase = getAdminClient()

    // Fetch existing barcodes from database to detect new vs existing updates
    const { data: existingRecords, error: fetchErr } = await supabase
      .from('product_enlistments')
      .select('id, barcode, name, target_platforms, enlistment_status')

    if (fetchErr) {
      console.error('Failed to fetch existing enlistments:', fetchErr)
    }

    const existingBarcodeMap = new Map<string, any>()
    for (const rec of existingRecords || []) {
      if (rec.barcode) {
        existingBarcodeMap.set(String(rec.barcode).trim(), rec)
      }
    }

    const parsedRows: any[] = []
    const validationErrors: Array<{ row: number; barcode: string; name: string; reason: string }> =
      []

    rawRows.forEach((r, idx) => {
      const rowNum = idx + 2 // 1-indexed Excel row (row 1 is header)

      const rawBarcode = getVal(r, 'Barcode', 'barcode', 'ean', 'sku', 'upc', 'code')
      const barcode = cleanStr(rawBarcode)

      const rawName = getVal(r, 'Name', 'Product Name', 'title', 'item_name', 'product')
      const name = cleanStr(rawName)

      if (!barcode && !name) {
        // Empty row, skip
        return
      }

      if (!barcode) {
        validationErrors.push({
          row: rowNum,
          barcode: '',
          name: name || 'Unknown Product',
          reason: 'Missing Barcode / EAN code',
        })
        return
      }

      if (!name) {
        validationErrors.push({
          row: rowNum,
          barcode,
          name: '',
          reason: 'Missing Product Name',
        })
        return
      }

      const slVal = parseIntNum(getVal(r, 'SL', 'sl', 'no', 'serial'), idx + 1)
      const dimL = parseNum(
        getVal(
          r,
          'Product Dimensions Length (Left to Right) in cm',
          'Dim L (cm)',
          'Dim L',
          'dim_length_cm',
          'length'
        ),
        0
      )
      const dimD = parseNum(
        getVal(
          r,
          'Product Dimensions Depth (Front to Back) in cm',
          'Dim D (cm)',
          'Dim D',
          'dim_depth_cm',
          'depth'
        ),
        0
      )
      const dimH = parseNum(
        getVal(
          r,
          'Product Dimensions Height (Top to Bottom) in cm',
          'Dim H (cm)',
          'Dim H',
          'dim_height_cm',
          'height'
        ),
        0
      )
      const shelfLife = parseIntNum(
        getVal(r, 'Shelf Life Time (Day)', 'Shelf Life', 'shelf_life_days', 'shelflife'),
        1095
      )
      const imageUrl = cleanStr(
        getVal(r, 'Image link', 'Image Link', 'image_url', 'image', 'packshot', 'photo')
      )
      const description = cleanStr(
        getVal(r, 'Product Description (Features)', 'Description', 'description', 'features', 'claims')
      )
      const dept = cleanStr(getVal(r, 'Dept', 'Department', 'dept')) || 'Personal Care'
      const category = cleanStr(getVal(r, 'Category', 'category')) || 'General'
      const subcategory = cleanStr(getVal(r, 'SubCategory', 'Sub Category', 'subcategory')) || null
      const pcsPerCrm = parseIntNum(
        getVal(r, 'Pcs Per CRM', 'Pcs / CRM', 'pcs_per_crm', 'crm', 'case_size'),
        50
      )
      const tp = parseNum(getVal(r, 'TP', 'Trade Price', 'tp', 'cost_price'), 0)
      const mrp = parseNum(getVal(r, 'MRP', 'Max Retail Price', 'mrp', 'retail_price'), 0)

      let margin = parseNum(getVal(r, 'Margin', 'margin'), 0)
      if (!margin && tp > 0 && mrp > 0) {
        margin = calculateMargin(tp, mrp)
      }

      const certLicense =
        cleanStr(getVal(r, 'Cert/Licns', 'Cert/License', 'cert_license', 'certification')) || 'BSTI'
      const brand =
        cleanStr(getVal(r, 'Brand', 'brand')) || 'UNILEVER'
      const supplierName =
        cleanStr(getVal(r, 'Supplier Name', 'supplier_name', 'supplier', 'manufacturer')) ||
        'UNILEVER BANGLADESH LIMITED'
      const countryOfOrigin =
        cleanStr(getVal(r, 'Country of Origin', 'country_of_origin', 'origin')) || 'Bangladesh'

      const rawStatus = cleanStr(getVal(r, 'Status', 'enlistment_status', 'status'))
      let status: EnlistmentStatus = defaultStatus
      if (['open', 'in_review', 'enlisted', 'paused'].includes(rawStatus.toLowerCase())) {
        status = rawStatus.toLowerCase() as EnlistmentStatus
      }

      const rawTargets = getVal(r, 'Target Platforms', 'target_platforms', 'platforms')
      const targetPlatforms = parsePlatformArray(rawTargets, defaultTargets)

      const rawEnlisted = getVal(r, 'Enlisted Platforms', 'enlisted_platforms', 'live_platforms')
      const enlistedPlatforms = parsePlatformArray(rawEnlisted, [])

      const existing = existingBarcodeMap.get(barcode)

      parsedRows.push({
        rowNum,
        isExisting: !!existing,
        existingId: existing?.id || null,
        data: {
          sl: slVal,
          barcode,
          name,
          dim_length_cm: dimL,
          dim_depth_cm: dimD,
          dim_height_cm: dimH,
          shelf_life_days: shelfLife,
          image_url: imageUrl || null,
          description: description || null,
          dept,
          category,
          subcategory,
          pcs_per_crm: pcsPerCrm,
          tp,
          mrp,
          margin,
          cert_license: certLicense,
          brand,
          supplier_name: supplierName,
          country_of_origin: countryOfOrigin,
          enlistment_status: status,
          target_platforms: targetPlatforms,
          enlisted_platforms: enlistedPlatforms,
        },
      })
    })

    if (parsedRows.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid products could be parsed from the file.',
          errors: validationErrors,
        },
        { status: 400 }
      )
    }

    // If PREVIEW mode: return parsed data without writing to database
    if (mode === 'preview') {
      return NextResponse.json({
        mode: 'preview',
        totalFound: rawRows.length,
        validCount: parsedRows.length,
        errorCount: validationErrors.length,
        newCount: parsedRows.filter((r) => !r.isExisting).length,
        updateCount: parsedRows.filter((r) => r.isExisting).length,
        errors: validationErrors,
        previewRows: parsedRows.map((p) => ({
          rowNum: p.rowNum,
          isExisting: p.isExisting,
          existingId: p.existingId,
          ...p.data,
        })),
      })
    }

    // COMMIT mode: Perform updates and inserts into Supabase
    let insertedCount = 0
    let updatedCount = 0
    const commitErrors: Array<{ row: number; barcode: string; reason: string }> = []

    // 1. Separate into updates vs inserts
    const toUpdate = parsedRows.filter((r) => r.isExisting && r.existingId)
    const toInsert = parsedRows.filter((r) => !r.isExisting)

    // Execute updates
    for (const item of toUpdate) {
      const payload: Record<string, any> = {
        ...item.data,
        updated_at: new Date().toISOString(),
      }

      let res = await supabase
        .from('product_enlistments')
        .update(payload)
        .eq('id', item.existingId)

      // Fallback if enlisted_platforms column doesn't exist yet
      if (res.error && res.error.code === '42703' && 'enlisted_platforms' in payload) {
        delete payload.enlisted_platforms
        res = await supabase
          .from('product_enlistments')
          .update(payload)
          .eq('id', item.existingId)
      }

      if (res.error) {
        commitErrors.push({
          row: item.rowNum,
          barcode: item.data.barcode,
          reason: res.error.message || 'Database update error',
        })
      } else {
        updatedCount++
      }
    }

    // Execute inserts in chunks of 50
    const insertPayloads = toInsert.map((item) => item.data)
    const CHUNK_SIZE = 50

    for (let i = 0; i < insertPayloads.length; i += CHUNK_SIZE) {
      const chunk = insertPayloads.slice(i, i + CHUNK_SIZE)

      let res = await supabase.from('product_enlistments').insert(chunk)

      // Fallback if column enlisted_platforms doesn't exist yet
      if (res.error && res.error.code === '42703') {
        const sanitizedChunk = chunk.map((c) => {
          const clone = { ...c }
          delete clone.enlisted_platforms
          return clone
        })
        res = await supabase.from('product_enlistments').insert(sanitizedChunk)
      }

      if (res.error) {
        console.error('Insert batch error:', res.error)
        commitErrors.push({
          row: i + 1,
          barcode: chunk.map((c) => c.barcode).join(', '),
          reason: res.error.message || 'Database insert batch error',
        })
      } else {
        insertedCount += chunk.length
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'commit',
      totalProcessed: parsedRows.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: validationErrors.length,
      validationErrors,
      commitErrors,
    })
  } catch (err: any) {
    console.error('Enlistment bulk import route exception:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal server error processing file upload' },
      { status: 500 }
    )
  }
}
