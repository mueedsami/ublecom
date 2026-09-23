import { demoMode, supabase } from './supabase'

export type Basepack = {
  id: string
  name: string
  business_unit: string | null
  category: string | null
  format: string | null
  brand: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type BasepackUsage = {
  basepack_id: string
  active_mappings: number
  ola_scopes: number
  cpp_scopes: number
  historical_snapshots: number
  historical_observations: number
}

export type BasepackInput = {
  name: string
  business_unit?: string | null
  category?: string | null
  format?: string | null
  brand?: string | null
}

export async function listBasepacks(): Promise<Basepack[]> {
  if (demoMode || !supabase) return []
  const { data, error } = await supabase
    .from('basepacks')
    .select('id,name,business_unit,category,format,brand,active,created_at,updated_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createBasepack(input: BasepackInput): Promise<Basepack> {
  if (demoMode || !supabase) throw new Error('Connect Supabase to add basepacks')
  const { data, error } = await supabase
    .from('basepacks')
    .insert({
      name: input.name.trim(),
      business_unit: input.business_unit || null,
      category: input.category || null,
      format: input.format || null,
      brand: input.brand || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Basepack
}

export async function updateBasepack(id: string, input: BasepackInput): Promise<Basepack> {
  if (demoMode || !supabase) throw new Error('Connect Supabase to edit basepacks')
  const { data, error } = await supabase
    .from('basepacks')
    .update({
      name: input.name.trim(),
      business_unit: input.business_unit || null,
      category: input.category || null,
      format: input.format || null,
      brand: input.brand || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Basepack
}

export async function setBasepackActive(id: string, active: boolean): Promise<void> {
  if (demoMode || !supabase) throw new Error('Connect Supabase to change basepack status')
  const { error } = await supabase.from('basepacks').update({ active }).eq('id', id)
  if (error) throw error
}

export async function getBasepackUsage(id: string): Promise<BasepackUsage | null> {
  if (demoMode || !supabase) return null
  const { data, error } = await supabase
    .from('v_basepack_usage')
    .select('basepack_id,active_mappings,ola_scopes,cpp_scopes,historical_snapshots,historical_observations')
    .eq('basepack_id', id)
    .maybeSingle()
  if (error) throw error
  return data as BasepackUsage | null
}

// --- Account product mappings (basepack ↔ account/location SKU) ---

export type Account = { id: string; code: string; name: string; account_type: string }
export type Location = { id: string; account_id: string; name: string; code: string }

export type AccountProduct = {
  id: string
  basepack_id: string
  account_id: string
  location_id: string | null
  account_sku: string
  product_name: string | null
  product_url: string | null
  slug: string | null
  active: boolean
  scrape_enabled: boolean
  created_at: string
  updated_at: string
  account: { id: string; code: string; name: string } | null
  location: { id: string; name: string } | null
}

export type AccountProductInput = {
  account_id: string
  location_id?: string | null
  account_sku: string
  product_name?: string | null
  product_url?: string | null
  slug?: string | null
}

export async function listAccounts(): Promise<Account[]> {
  if (demoMode || !supabase) return []
  const { data, error } = await supabase
    .from('accounts')
    .select('id,code,name,account_type')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listLocationsForAccount(accountId: string): Promise<Location[]> {
  if (demoMode || !supabase) return []
  const { data, error } = await supabase
    .from('locations')
    .select('id,account_id,name,code')
    .eq('account_id', accountId)
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listAccountProducts(basepackId: string): Promise<AccountProduct[]> {
  if (demoMode || !supabase) return []
  const { data, error } = await supabase
    .from('account_products')
    .select('id,basepack_id,account_id,location_id,account_sku,product_name,product_url,slug,active,scrape_enabled,created_at,updated_at,account:accounts(id,code,name),location:locations(id,name)')
    .eq('basepack_id', basepackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as unknown as AccountProduct[]
}

export async function addAccountProduct(basepackId: string, input: AccountProductInput): Promise<AccountProduct> {
  if (demoMode || !supabase) throw new Error('Connect Supabase to add account mappings')
  const { data, error } = await supabase
    .from('account_products')
    .insert({
      basepack_id: basepackId,
      account_id: input.account_id,
      location_id: input.location_id || null,
      account_sku: input.account_sku.trim(),
      product_name: input.product_name || null,
      product_url: input.product_url || null,
      slug: input.slug || null,
    })
    .select('id,basepack_id,account_id,location_id,account_sku,product_name,product_url,slug,active,scrape_enabled,created_at,updated_at,account:accounts(id,code,name),location:locations(id,name)')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('This account already has that SKU mapped to this basepack (and location, if any).')
    throw error
  }
  return data as unknown as AccountProduct
}

export async function updateAccountProduct(id: string, input: Partial<AccountProductInput>): Promise<void> {
  if (demoMode || !supabase) throw new Error('Connect Supabase to edit account mappings')
  const patch: Record<string, any> = {}
  if (input.account_sku !== undefined) patch.account_sku = input.account_sku.trim()
  if (input.product_name !== undefined) patch.product_name = input.product_name || null
  if (input.product_url !== undefined) patch.product_url = input.product_url || null
  if (input.slug !== undefined) patch.slug = input.slug || null
  const { error } = await supabase.from('account_products').update(patch).eq('id', id)
  if (error) throw error
}

export async function setAccountProductActive(id: string, active: boolean): Promise<void> {
  if (demoMode || !supabase) throw new Error('Connect Supabase to change mapping status')
  const { error } = await supabase.from('account_products').update({ active }).eq('id', id)
  if (error) throw error
}

export async function setAccountProductScrapeEnabled(id: string, scrape_enabled: boolean): Promise<void> {
  if (demoMode || !supabase) throw new Error('Connect Supabase to change scrape status')
  const { error } = await supabase.from('account_products').update({ scrape_enabled }).eq('id', id)
  if (error) throw error
}
