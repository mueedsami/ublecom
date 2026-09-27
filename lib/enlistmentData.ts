import { supabase, demoMode } from './supabase'

export type EnlistmentStatus = 'open' | 'in_review' | 'enlisted' | 'paused'

export const STANDARD_PLATFORMS = [
  'Chaldal',
  'Daraz',
  'Shwapno',
  'PandaMart',
  'MeenaClick',
] as const

export type StandardPlatform = (typeof STANDARD_PLATFORMS)[number]

export interface EnlistmentAccount {
  id: string
  code: string
  name: string
  account_type: 'retailer' | 'marketplace' | 'quick_commerce'
  active: boolean
  created_at?: string
  updated_at?: string
}

const LOCAL_ACCOUNTS_KEY = 'ubl_enlistment_accounts_custom_v1'

export async function getEnlistmentAccounts(): Promise<EnlistmentAccount[]> {
  try {
    const res = await fetch('/api/enlistment/accounts', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data.accounts && Array.isArray(data.accounts)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(data.accounts))
        }
        return data.accounts
      }
    }
  } catch (e) {
    console.warn('Could not fetch accounts from API, falling back to local cache:', e)
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      // ignore
    }
  }

  return STANDARD_PLATFORMS.map((name) => ({
    id: `acc-${name.toLowerCase()}`,
    code: name.toLowerCase(),
    name,
    account_type: 'retailer',
    active: true,
  }))
}

export async function createEnlistmentAccount(input: {
  name: string
  account_type?: 'retailer' | 'marketplace' | 'quick_commerce'
}): Promise<EnlistmentAccount> {
  const res = await fetch('/api/enlistment/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to create account')
  }
  const data = await res.json()
  return data.account
}

export async function toggleAccountActive(
  id: string,
  active: boolean
): Promise<EnlistmentAccount> {
  const res = await fetch('/api/enlistment/accounts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, active }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to update account status')
  }
  const data = await res.json()
  return data.account
}

export async function deleteEnlistmentAccount(id: string): Promise<void> {
  const res = await fetch(`/api/enlistment/accounts?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to delete account')
  }
}

export interface EnlistmentProduct {
  id: string
  sl: number
  barcode: string
  dim_length_cm: number
  dim_depth_cm: number
  dim_height_cm: number
  shelf_life_days: number
  name: string
  image_url: string
  description: string
  dept: string
  category: string
  subcategory: string
  pcs_per_crm: number
  tp: number
  mrp: number
  margin: number
  cert_license: string
  brand: string
  supplier_name: string
  country_of_origin: string
  enlistment_status: EnlistmentStatus
  target_platforms: string[]
  enlisted_platforms?: string[]
  notes?: string
  created_at?: string
  updated_at?: string
}

export type EnlistmentInput = Omit<EnlistmentProduct, 'id' | 'created_at' | 'updated_at'>

export interface EnlistmentKPIs {
  total_products: number
  open_enlistments: number
  in_review: number
  enlisted_live: number
  avg_margin_pct: number
  total_brands: number
  enlisted_by_platform: Record<string, number>
  targeted_by_platform: Record<string, number>
}

const LOCAL_FALLBACK_KEY = 'ubl_enlisted_platforms_fallback_v1'

// Read local fallback storage for enlisted_platforms if DB column has not been migrated yet
function getLocalFallbackMap(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_FALLBACK_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalFallback(id: string, platforms: string[]) {
  if (typeof window === 'undefined') return
  try {
    const map = getLocalFallbackMap()
    map[id] = platforms
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export function calculateMargin(tp: number, mrp: number): number {
  if (!mrp || mrp <= 0) return 0
  const margin = ((mrp - tp) / mrp) * 100
  return Number(margin.toFixed(2))
}

export async function getEnlistmentProducts(): Promise<EnlistmentProduct[]> {
  if (!supabase) {
    throw new Error('Supabase client is not configured')
  }

  const { data, error } = await supabase
    .from('product_enlistments')
    .select('*')
    .order('sl', { ascending: true })

  if (error) {
    console.error('Supabase product_enlistments table fetch error:', error)
    throw error
  }

  const fallbackMap = getLocalFallbackMap()

  return (data || []).map((row: any) => {
    const enlisted = Array.isArray(row.enlisted_platforms)
      ? row.enlisted_platforms
      : (fallbackMap[row.id] || [])
    return {
      ...row,
      target_platforms: Array.isArray(row.target_platforms) ? row.target_platforms : [],
      enlisted_platforms: enlisted,
    } as EnlistmentProduct
  })
}

export async function createEnlistmentProduct(input: EnlistmentInput): Promise<EnlistmentProduct> {
  if (!supabase) throw new Error('Database connection not available')
  const calculatedMargin = input.margin || calculateMargin(input.tp, input.mrp)

  const payload: Record<string, any> = {
    sl: input.sl,
    barcode: input.barcode.trim(),
    dim_length_cm: input.dim_length_cm,
    dim_depth_cm: input.dim_depth_cm,
    dim_height_cm: input.dim_height_cm,
    shelf_life_days: input.shelf_life_days,
    name: input.name.trim(),
    image_url: input.image_url?.trim() || null,
    description: input.description?.trim() || null,
    dept: input.dept,
    category: input.category,
    subcategory: input.subcategory?.trim() || null,
    pcs_per_crm: input.pcs_per_crm,
    tp: input.tp,
    mrp: input.mrp,
    margin: calculatedMargin,
    cert_license: input.cert_license?.trim() || 'BSTI',
    brand: input.brand.trim(),
    supplier_name: input.supplier_name?.trim() || 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: input.country_of_origin?.trim() || 'Bangladesh',
    enlistment_status: input.enlistment_status || 'open',
    target_platforms: input.target_platforms || [],
    enlisted_platforms: input.enlisted_platforms || [],
    notes: input.notes?.trim() || null,
  }

  // Attempt insert with enlisted_platforms
  let result = await supabase
    .from('product_enlistments')
    .insert([payload])
    .select()
    .single()

  // If column does not exist in schema (code 42703), retry without enlisted_platforms
  if (result.error && result.error.code === '42703') {
    const fallbackPayload = { ...payload }
    delete fallbackPayload.enlisted_platforms
    result = await supabase
      .from('product_enlistments')
      .insert([fallbackPayload])
      .select()
      .single()

    if (!result.error && result.data) {
      saveLocalFallback(result.data.id, input.enlisted_platforms || [])
      result.data.enlisted_platforms = input.enlisted_platforms || []
    }
  }

  if (result.error) {
    console.error('Failed to create product in database:', result.error)
    throw result.error
  }

  return {
    ...result.data,
    target_platforms: result.data.target_platforms || [],
    enlisted_platforms: result.data.enlisted_platforms || input.enlisted_platforms || [],
  } as EnlistmentProduct
}

export async function updateEnlistmentProduct(
  id: string,
  updates: Partial<EnlistmentProduct>
): Promise<EnlistmentProduct> {
  if (!supabase) throw new Error('Database connection not available')

  let margin = updates.margin
  if (updates.tp !== undefined && updates.mrp !== undefined) {
    margin = calculateMargin(updates.tp, updates.mrp)
  }

  const cleanUpdates: Record<string, any> = {
    ...updates,
    ...(margin !== undefined ? { margin } : {}),
    updated_at: new Date().toISOString(),
  }

  delete cleanUpdates.id

  let result = await supabase
    .from('product_enlistments')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single()

  // Handle case where enlisted_platforms column doesn't exist yet in DB
  if (result.error && result.error.code === '42703' && 'enlisted_platforms' in cleanUpdates) {
    const enlisted = cleanUpdates.enlisted_platforms
    delete cleanUpdates.enlisted_platforms

    result = await supabase
      .from('product_enlistments')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (!result.error && result.data) {
      saveLocalFallback(id, enlisted || [])
      result.data.enlisted_platforms = enlisted || []
    }
  }

  if (result.error) {
    console.error('Failed to update product in database:', result.error)
    throw result.error
  }

  const fallbackMap = getLocalFallbackMap()
  const enlisted = Array.isArray(result.data.enlisted_platforms)
    ? result.data.enlisted_platforms
    : (fallbackMap[id] || updates.enlisted_platforms || [])

  return {
    ...result.data,
    target_platforms: result.data.target_platforms || [],
    enlisted_platforms: enlisted,
  } as EnlistmentProduct
}

export async function deleteEnlistmentProduct(id: string): Promise<void> {
  if (!supabase) throw new Error('Database connection not available')

  const { error } = await supabase
    .from('product_enlistments')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete product from database:', error)
    throw error
  }
}

/**
 * Toggle single platform enlisted status for a product.
 * Automatically adds the platform to target_platforms if not already present.
 */
export async function togglePlatformEnlisted(
  product: EnlistmentProduct,
  platform: string
): Promise<EnlistmentProduct> {
  const currentEnlisted = new Set(product.enlisted_platforms || [])
  const isCurrentlyEnlisted = currentEnlisted.has(platform)

  if (isCurrentlyEnlisted) {
    currentEnlisted.delete(platform)
  } else {
    currentEnlisted.add(platform)
  }

  const newEnlisted = Array.from(currentEnlisted)

  // Ensure target_platforms contains platform if enlisted
  const currentTargets = new Set(product.target_platforms || [])
  if (!isCurrentlyEnlisted && !currentTargets.has(platform)) {
    currentTargets.add(platform)
  }

  // Update enlistment_status automatically if all target platforms are live
  let newStatus = product.enlistment_status
  if (newEnlisted.length > 0) {
    newStatus = 'enlisted'
  } else if (product.enlistment_status === 'enlisted' && newEnlisted.length === 0) {
    newStatus = 'open'
  }

  return updateEnlistmentProduct(product.id, {
    target_platforms: Array.from(currentTargets),
    enlisted_platforms: newEnlisted,
    enlistment_status: newStatus,
  })
}

/**
 * Bulk mark multiple products as enlisted or pending on a specific platform
 */
export async function bulkMarkEnlisted(
  products: EnlistmentProduct[],
  ids: string[],
  platform: string,
  markAsEnlisted: boolean = true
): Promise<EnlistmentProduct[]> {
  const targetMap = new Map(products.map((p) => [p.id, p]))
  const updatedList: EnlistmentProduct[] = []

  for (const id of ids) {
    const prod = targetMap.get(id)
    if (!prod) continue

    const currentEnlisted = new Set(prod.enlisted_platforms || [])
    const currentTargets = new Set(prod.target_platforms || [])

    if (markAsEnlisted) {
      currentEnlisted.add(platform)
      currentTargets.add(platform)
    } else {
      currentEnlisted.delete(platform)
    }

    const newEnlisted = Array.from(currentEnlisted)
    let newStatus = prod.enlistment_status
    if (newEnlisted.length > 0) {
      newStatus = 'enlisted'
    } else if (prod.enlistment_status === 'enlisted' && newEnlisted.length === 0) {
      newStatus = 'open'
    }

    const updated = await updateEnlistmentProduct(id, {
      target_platforms: Array.from(currentTargets),
      enlisted_platforms: newEnlisted,
      enlistment_status: newStatus,
    })
    updatedList.push(updated)
  }

  return updatedList
}

/**
 * Bulk set target platforms across multiple products
 */
export async function bulkSetTargetPlatforms(
  products: EnlistmentProduct[],
  ids: string[],
  platforms: string[]
): Promise<EnlistmentProduct[]> {
  const updatedList: EnlistmentProduct[] = []

  for (const id of ids) {
    const prod = products.find((p) => p.id === id)
    if (!prod) continue

    // Filter enlisted_platforms to only those still in targets
    const allowed = new Set(platforms)
    const newEnlisted = (prod.enlisted_platforms || []).filter((p) => allowed.has(p))

    const updated = await updateEnlistmentProduct(id, {
      target_platforms: platforms,
      enlisted_platforms: newEnlisted,
    })
    updatedList.push(updated)
  }

  return updatedList
}

/**
 * Bulk update enlistment status across multiple products
 */
export async function bulkUpdateStatus(
  ids: string[],
  status: EnlistmentStatus
): Promise<void> {
  if (!supabase) throw new Error('Database connection not available')

  const { error } = await supabase
    .from('product_enlistments')
    .update({
      enlistment_status: status,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (error) {
    console.error('Failed to bulk update status:', error)
    throw error
  }
}

/**
 * Bulk delete products
 */
export async function bulkDeleteProducts(ids: string[]): Promise<void> {
  if (!supabase) throw new Error('Database connection not available')

  const { error } = await supabase
    .from('product_enlistments')
    .delete()
    .in('id', ids)

  if (error) {
    console.error('Failed to bulk delete products:', error)
    throw error
  }
}

export function computeEnlistmentKPIs(items: EnlistmentProduct[]): EnlistmentKPIs {
  const total = items.length
  if (total === 0) {
    return {
      total_products: 0,
      open_enlistments: 0,
      in_review: 0,
      enlisted_live: 0,
      avg_margin_pct: 0,
      total_brands: 0,
      enlisted_by_platform: {},
      targeted_by_platform: {},
    }
  }

  const open_enlistments = items.filter((i) => i.enlistment_status === 'open').length
  const in_review = items.filter((i) => i.enlistment_status === 'in_review').length
  const enlisted_live = items.filter(
    (i) => i.enlistment_status === 'enlisted' || (i.enlisted_platforms && i.enlisted_platforms.length > 0)
  ).length

  const sumMargin = items.reduce((acc, curr) => acc + (Number(curr.margin) || 0), 0)
  const avg_margin_pct = Number((sumMargin / total).toFixed(2))

  const brands = new Set(items.map((i) => i.brand?.trim().toUpperCase()).filter(Boolean))

  const enlisted_by_platform: Record<string, number> = {}
  const targeted_by_platform: Record<string, number> = {}

  for (const item of items) {
    for (const plat of item.target_platforms || []) {
      targeted_by_platform[plat] = (targeted_by_platform[plat] || 0) + 1
      targeted_by_platform[plat.toLowerCase()] = (targeted_by_platform[plat.toLowerCase()] || 0) + 1
    }
    for (const plat of item.enlisted_platforms || []) {
      enlisted_by_platform[plat] = (enlisted_by_platform[plat] || 0) + 1
      enlisted_by_platform[plat.toLowerCase()] = (enlisted_by_platform[plat.toLowerCase()] || 0) + 1
    }
  }

  return {
    total_products: total,
    open_enlistments,
    in_review,
    enlisted_live,
    avg_margin_pct,
    total_brands: brands.size,
    enlisted_by_platform,
    targeted_by_platform,
  }
}

export function exportEnlistmentToCSV(items: EnlistmentProduct[]): string {
  // Columns matching the exact layout from user's specification sheet + tracking
  const headers = [
    'SL',
    'Barcode',
    'Product Dimensions Length (Left to Right) in cm',
    'Product Dimensions Depth (Front to Back) in cm',
    'Product Dimensions Height (Top to Bottom) in cm',
    'Shelf Life Time (Day)',
    'Name',
    'Image link',
    'Product Description (Features)',
    'Dept',
    'Category',
    'SubCategory',
    'Pcs Per CRM',
    'TP',
    'MRP',
    'Margin',
    'Cert/Licns',
    'Brand',
    'Supplier Name',
    'Country of Origin',
    'Status',
    'Target Platforms',
    'Enlisted Platforms',
  ]

  const rows = items.map((p, idx) => [
    p.sl || idx + 1,
    `"${p.barcode || ''}"`,
    p.dim_length_cm ?? 0,
    p.dim_depth_cm ?? 0,
    p.dim_height_cm ?? 0,
    p.shelf_life_days ?? 1095,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.image_url || '').replace(/"/g, '""')}"`,
    `"${(p.description || '').replace(/"/g, '""')}"`,
    `"${(p.dept || '').replace(/"/g, '""')}"`,
    `"${(p.category || '').replace(/"/g, '""')}"`,
    `"${(p.subcategory || '').replace(/"/g, '""')}"`,
    p.pcs_per_crm ?? 50,
    p.tp ?? 0,
    p.mrp ?? 0,
    `${p.margin ?? 0}%`,
    `"${(p.cert_license || '').replace(/"/g, '""')}"`,
    `"${(p.brand || '').replace(/"/g, '""')}"`,
    `"${(p.supplier_name || '').replace(/"/g, '""')}"`,
    `"${(p.country_of_origin || '').replace(/"/g, '""')}"`,
    p.enlistment_status || 'open',
    `"${(p.target_platforms || []).join(', ')}"`,
    `"${(p.enlisted_platforms || []).join(', ')}"`,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
