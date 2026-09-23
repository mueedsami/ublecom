import { supabase, demoMode } from './supabase'

export type EnlistmentStatus = 'open' | 'in_review' | 'enlisted' | 'paused'

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
}

const STORAGE_KEY = 'ubl_product_enlistments_v1'

// Helper to remove any stale mock products cached in browser storage
export function clearMockStorage(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

export function calculateMargin(tp: number, mrp: number): number {
  if (!mrp || mrp <= 0) return 0
  const margin = ((mrp - tp) / mrp) * 100
  return Number(margin.toFixed(2))
}

export async function getEnlistmentProducts(): Promise<EnlistmentProduct[]> {
  clearMockStorage()

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

  return (data || []) as EnlistmentProduct[]
}

export async function createEnlistmentProduct(input: EnlistmentInput): Promise<EnlistmentProduct> {
  if (!supabase) throw new Error('Database connection not available')
  const calculatedMargin = input.margin || calculateMargin(input.tp, input.mrp)

  const payload = {
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
    enlistment_status: input.enlistment_status,
    target_platforms: input.target_platforms || [],
    notes: input.notes?.trim() || null,
  }

  const { data, error } = await supabase
    .from('product_enlistments')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('Failed to create product in database:', error)
    throw error
  }

  return data as EnlistmentProduct
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

  // Remove client-generated synthetic IDs if present
  delete cleanUpdates.id

  const { data, error } = await supabase
    .from('product_enlistments')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update product in database:', error)
    throw error
  }

  return data as EnlistmentProduct
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
    }
  }

  const open_enlistments = items.filter((i) => i.enlistment_status === 'open').length
  const in_review = items.filter((i) => i.enlistment_status === 'in_review').length
  const enlisted_live = items.filter((i) => i.enlistment_status === 'enlisted').length

  const sumMargin = items.reduce((acc, curr) => acc + (Number(curr.margin) || 0), 0)
  const avg_margin_pct = Number((sumMargin / total).toFixed(2))

  const brands = new Set(items.map((i) => i.brand.trim().toUpperCase()))

  return {
    total_products: total,
    open_enlistments,
    in_review,
    enlisted_live,
    avg_margin_pct,
    total_brands: brands.size,
  }
}

export function exportEnlistmentToCSV(items: EnlistmentProduct[]): string {
  // Columns matching the exact layout from user's specification sheet
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
    'Target Platforms'
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
    p.enlistment_status,
    `"${(p.target_platforms || []).join(', ')}"`
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
