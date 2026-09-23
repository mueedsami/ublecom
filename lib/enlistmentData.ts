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

// Initial seed products matching the user's specification sheet + core Unilever portfolio
export const INITIAL_ENLISTMENT_PRODUCTS: EnlistmentProduct[] = [
  {
    id: 'enl-001',
    sl: 1,
    barcode: '8941100511261',
    dim_length_cm: 5.5,
    dim_depth_cm: 4.1,
    dim_height_cm: 2.0,
    shelf_life_days: 1095,
    name: "Ponds Bright Miracle Serum Night 30g",
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
    description: "Pond's Bright Miracle Serum Night 30g contains Gluta-Boost-C which is 60X more effective than Vitamin C. Fades dark spots, reduces dullness, and boosts skin radiance overnight.",
    dept: 'Beauty & Wellbeing',
    category: 'Skin Care',
    subcategory: 'Serum',
    pcs_per_crm: 50,
    tp: 50.83,
    mrp: 55.00,
    margin: 7.57,
    cert_license: 'BSTI',
    brand: 'PONDS',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'open',
    target_platforms: ['Chaldal', 'Daraz', 'Shwapno', 'PandaMart'],
    created_at: '2026-09-20T10:00:00Z',
    updated_at: '2026-09-23T15:30:00Z',
  },
  {
    id: 'enl-002',
    sl: 2,
    barcode: '8941100511278',
    dim_length_cm: 6.2,
    dim_depth_cm: 4.5,
    dim_height_cm: 14.8,
    shelf_life_days: 730,
    name: 'Dove Deep Moisture Nourishing Body Wash 250ml',
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    description: 'Dove Deep Moisture Body Wash gives you instantly soft, smooth skin. Infused with NutriumMoisture technology to nourish deep into the surface layers of your skin.',
    dept: 'Personal Care',
    category: 'Skin Cleansing',
    subcategory: 'Body Wash',
    pcs_per_crm: 24,
    tp: 315.00,
    mrp: 350.00,
    margin: 10.00,
    cert_license: 'BSTI',
    brand: 'Dove',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'open',
    target_platforms: ['Chaldal', 'Daraz', 'Shwapno'],
    created_at: '2026-09-20T11:00:00Z',
    updated_at: '2026-09-23T14:10:00Z',
  },
  {
    id: 'enl-003',
    sl: 3,
    barcode: '8941100511285',
    dim_length_cm: 7.0,
    dim_depth_cm: 4.2,
    dim_height_cm: 19.5,
    shelf_life_days: 1095,
    name: 'Sunsilk Stunning Black Shine Shampoo 375ml',
    image_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
    description: 'Sunsilk Stunning Black Shine Shampoo co-created with Jamal Hammadi. Enriched with Amla Pearl complex to give your hair a healthy, long-lasting shine.',
    dept: 'Personal Care',
    category: 'Hair Care',
    subcategory: 'Shampoo',
    pcs_per_crm: 36,
    tp: 382.50,
    mrp: 425.00,
    margin: 10.00,
    cert_license: 'BSTI',
    brand: 'Sunsilk',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'enlisted',
    target_platforms: ['Chaldal', 'Daraz', 'Shwapno', 'PandaMart'],
    created_at: '2026-09-18T09:30:00Z',
    updated_at: '2026-09-22T16:00:00Z',
  },
  {
    id: 'enl-004',
    sl: 4,
    barcode: '8941100511292',
    dim_length_cm: 8.0,
    dim_depth_cm: 3.5,
    dim_height_cm: 11.2,
    shelf_life_days: 1095,
    name: 'Vaseline Intensive Care Deep Restore Lotion 200ml',
    image_url: 'https://images.unsplash.com/photo-1585232351009-aa87416fca90?auto=format&fit=crop&w=600&q=80',
    description: 'Vaseline Intensive Care Deep Restore moisturizes dry skin from the first application. Contains micro-droplets of Vaseline Jelly to lock in moisture.',
    dept: 'Beauty & Wellbeing',
    category: 'Skin Care',
    subcategory: 'Lotion',
    pcs_per_crm: 24,
    tp: 270.00,
    mrp: 300.00,
    margin: 10.00,
    cert_license: 'BSTI',
    brand: 'Vaseline',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'in_review',
    target_platforms: ['Chaldal', 'Daraz'],
    created_at: '2026-09-21T08:15:00Z',
    updated_at: '2026-09-23T11:45:00Z',
  },
  {
    id: 'enl-005',
    sl: 5,
    barcode: '8941100511308',
    dim_length_cm: 9.5,
    dim_depth_cm: 3.0,
    dim_height_cm: 5.8,
    shelf_life_days: 1095,
    name: 'Lifebuoy Total 10 Germ Protection Soap 100g',
    image_url: 'https://images.unsplash.com/photo-1607006314188-755c3c0efcf9?auto=format&fit=crop&w=600&q=80',
    description: 'Lifebuoy Total 10 Soap contains Activ Silver Formula for 99.9% germ protection in just 10 seconds. Keeps your family shielded from illness-causing germs.',
    dept: 'Personal Care',
    category: 'Skin Cleansing',
    subcategory: 'Bar Soap',
    pcs_per_crm: 72,
    tp: 58.50,
    mrp: 65.00,
    margin: 10.00,
    cert_license: 'BSTI',
    brand: 'Lifebuoy',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'enlisted',
    target_platforms: ['Chaldal', 'Daraz', 'Shwapno', 'PandaMart', 'MeenaClick'],
    created_at: '2026-09-17T14:20:00Z',
    updated_at: '2026-09-22T09:00:00Z',
  },
  {
    id: 'enl-006',
    sl: 6,
    barcode: '8941100511315',
    dim_length_cm: 4.8,
    dim_depth_cm: 3.2,
    dim_height_cm: 13.5,
    shelf_life_days: 730,
    name: 'Glow & Lovely Advanced Multivitamin Face Cream 50g',
    image_url: 'https://images.unsplash.com/photo-1556228722-d0b5be7490bf?auto=format&fit=crop&w=600&q=80',
    description: 'Glow & Lovely Advanced Multivitamin gives high-definition glow, evens skin tone, and protects against sun darkening with Vitamin B3, C, and E.',
    dept: 'Beauty & Wellbeing',
    category: 'Skin Care',
    subcategory: 'Face Cream',
    pcs_per_crm: 48,
    tp: 148.50,
    mrp: 165.00,
    margin: 10.00,
    cert_license: 'BSTI',
    brand: 'Glow & Lovely',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'open',
    target_platforms: ['Chaldal', 'Daraz', 'Shwapno', 'PandaMart'],
    created_at: '2026-09-21T16:00:00Z',
    updated_at: '2026-09-23T10:15:00Z',
  },
  {
    id: 'enl-007',
    sl: 7,
    barcode: '8941100511322',
    dim_length_cm: 6.5,
    dim_depth_cm: 4.0,
    dim_height_cm: 18.0,
    shelf_life_days: 1095,
    name: 'Tresemme Keratin Smooth Shampoo 340ml',
    image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    description: 'Tresemme Keratin Smooth with Argan Oil controls frizz for up to 72 hours, leaving hair salon-smooth and full of natural movement.',
    dept: 'Personal Care',
    category: 'Hair Care',
    subcategory: 'Shampoo',
    pcs_per_crm: 24,
    tp: 495.00,
    mrp: 550.00,
    margin: 10.00,
    cert_license: 'BSTI',
    brand: 'Tresemme',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'open',
    target_platforms: ['Daraz', 'Chaldal'],
    created_at: '2026-09-22T13:00:00Z',
    updated_at: '2026-09-23T12:00:00Z',
  },
  {
    id: 'enl-008',
    sl: 8,
    barcode: '8941100511339',
    dim_length_cm: 3.8,
    dim_depth_cm: 3.8,
    dim_height_cm: 16.5,
    shelf_life_days: 1095,
    name: 'Closeup Everfresh Red Hot Gel Toothpaste 150g',
    image_url: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=600&q=80',
    description: 'Closeup Red Hot gel toothpaste with antibacterial zinc mouthwash gives up to 12 hours of fresh breath and a whiter smile.',
    dept: 'Personal Care',
    category: 'Oral Care',
    subcategory: 'Toothpaste',
    pcs_per_crm: 48,
    tp: 126.00,
    mrp: 140.00,
    margin: 10.00,
    cert_license: 'BSTI',
    brand: 'Closeup',
    supplier_name: 'UNILEVER BANGLADESH LIMITED',
    country_of_origin: 'Bangladesh',
    enlistment_status: 'enlisted',
    target_platforms: ['Chaldal', 'Daraz', 'Shwapno', 'PandaMart'],
    created_at: '2026-09-19T10:00:00Z',
    updated_at: '2026-09-23T09:30:00Z',
  }
]

const STORAGE_KEY = 'ubl_product_enlistments_v1'

export function calculateMargin(tp: number, mrp: number): number {
  if (!mrp || mrp <= 0) return 0
  const margin = ((mrp - tp) / mrp) * 100
  return Number(margin.toFixed(2))
}

function getLocalStore(): EnlistmentProduct[] {
  if (typeof window === 'undefined') return INITIAL_ENLISTMENT_PRODUCTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ENLISTMENT_PRODUCTS))
      return INITIAL_ENLISTMENT_PRODUCTS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ENLISTMENT_PRODUCTS
  } catch (err) {
    console.warn('Failed reading localStorage, using initial dataset:', err)
    return INITIAL_ENLISTMENT_PRODUCTS
  }
}

function setLocalStore(items: EnlistmentProduct[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (err) {
    console.error('Failed writing to localStorage:', err)
  }
}

export async function getEnlistmentProducts(): Promise<EnlistmentProduct[]> {
  if (!demoMode && supabase) {
    try {
      const { data, error } = await supabase
        .from('product_enlistments')
        .select('*')
        .order('sl', { ascending: true })

      if (!error && data && data.length > 0) {
        return data as EnlistmentProduct[]
      }
    } catch (err) {
      console.warn('Supabase product_enlistments table fetch error, falling back to local store:', err)
    }
  }

  return getLocalStore()
}

export async function createEnlistmentProduct(input: EnlistmentInput): Promise<EnlistmentProduct> {
  const calculatedMargin = input.margin || calculateMargin(input.tp, input.mrp)
  const newProduct: EnlistmentProduct = {
    ...input,
    id: `enl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    margin: calculatedMargin,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (!demoMode && supabase) {
    try {
      const { data, error } = await supabase
        .from('product_enlistments')
        .insert([{
          sl: newProduct.sl,
          barcode: newProduct.barcode,
          dim_length_cm: newProduct.dim_length_cm,
          dim_depth_cm: newProduct.dim_depth_cm,
          dim_height_cm: newProduct.dim_height_cm,
          shelf_life_days: newProduct.shelf_life_days,
          name: newProduct.name,
          image_url: newProduct.image_url,
          description: newProduct.description,
          dept: newProduct.dept,
          category: newProduct.category,
          subcategory: newProduct.subcategory,
          pcs_per_crm: newProduct.pcs_per_crm,
          tp: newProduct.tp,
          mrp: newProduct.mrp,
          margin: newProduct.margin,
          cert_license: newProduct.cert_license,
          brand: newProduct.brand,
          supplier_name: newProduct.supplier_name,
          country_of_origin: newProduct.country_of_origin,
          enlistment_status: newProduct.enlistment_status,
          target_platforms: newProduct.target_platforms,
          notes: newProduct.notes
        }])
        .select()
        .single()

      if (!error && data) {
        return data as EnlistmentProduct
      }
    } catch (err) {
      console.warn('Supabase insert failed, persisting to local store:', err)
    }
  }

  const items = getLocalStore()
  const updatedList = [newProduct, ...items]
  setLocalStore(updatedList)
  return newProduct
}

export async function updateEnlistmentProduct(id: string, updates: Partial<EnlistmentProduct>): Promise<EnlistmentProduct> {
  let margin = updates.margin
  if (updates.tp !== undefined && updates.mrp !== undefined) {
    margin = calculateMargin(updates.tp, updates.mrp)
  }

  const cleanUpdates = {
    ...updates,
    ...(margin !== undefined ? { margin } : {}),
    updated_at: new Date().toISOString()
  }

  if (!demoMode && supabase) {
    try {
      const { data, error } = await supabase
        .from('product_enlistments')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single()

      if (!error && data) {
        return data as EnlistmentProduct
      }
    } catch (err) {
      console.warn('Supabase update failed, persisting to local store:', err)
    }
  }

  const items = getLocalStore()
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) {
    throw new Error(`Product with ID ${id} not found`)
  }

  const updatedProduct = { ...items[index], ...cleanUpdates }
  items[index] = updatedProduct
  setLocalStore(items)
  return updatedProduct
}

export async function deleteEnlistmentProduct(id: string): Promise<void> {
  if (!demoMode && supabase) {
    try {
      const { error } = await supabase
        .from('product_enlistments')
        .delete()
        .eq('id', id)

      if (!error) return
    } catch (err) {
      console.warn('Supabase delete failed, persisting to local store:', err)
    }
  }

  const items = getLocalStore().filter((i) => i.id !== id)
  setLocalStore(items)
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
