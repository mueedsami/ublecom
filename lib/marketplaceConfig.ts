/**
 * Marketplace Config & Column Normalization Engine
 * Parameterized by account code (othoba, shajgoj, daraz).
 * Absorbs header drift across months and accounts.
 */

export interface MarketplaceAccountConfig {
  code: string
  name: string
  displayName: string
  singleStorefront: boolean
  defaultVendorName: string
  columnAliases: Record<string, (string | RegExp)[]>
}

export const MARKETPLACE_ACCOUNTS: Record<string, MarketplaceAccountConfig> = {
  othoba: {
    code: 'othoba',
    name: 'Othoba',
    displayName: 'Othoba Stock & Sales Tracker',
    singleStorefront: true,
    defaultVendorName: 'Unilever Flagship Store',
    columnAliases: {
      productId: ['ProductId', 'Product ID', 'Product_Id', 'product_id', 'productid', 'ID'],
      name: ['ProductName', 'Product Name', 'Item_Name', 'Item Name', 'Name', 'Title', 'Product'],
      sku: ['Sku', 'SKU', 'Item_Id', 'Item ID', 'Account SKU'],
      vendorName: ['VendorName', 'Vendor Name', 'Vendor', 'Store Name', 'Seller'],
      currentStock: ['Current Stock', 'Stock', 'current_stock', 'stock_qty', 'Quantity', 'Qty'],
      soldQty: [
        /^Sold\s*Qty/i,
        /^Total\s*(Sold\s*)?Qty/i,
        'sold_qty',
        'Total Sold QTY',
        'Total QTY',
        'sold_units',
      ],
      runRate: ['Run Rate', 'RunRate', 'run_rate', 'Daily Run Rate'],
      mrp: ['MRP', 'Unit Price', 'Regular Price', 'List Price', 'Price'],
      tp: ['TP', 'Unit Selling Price', 'Selling Price', 'Offer Price', 'Discounted Price'],
      stockValue: ['Stock value', 'Stock Value', 'stock_value', 'Total Stock Value'],
      productCost: ['Product Cost', 'Cost Price', 'product_cost'],
      totalProductCost: ['Total Product Cost', 'total_product_cost'],
      totalAmount: ['Total Amount', 'Total Revenue', 'Total Sales', 'GFV', 'Total Value', 'total_amount'],
      subOrderRefs: ['Sub Order Ids', 'Sub Order ID', 'Order IDs', 'Orders', 'sub_order_refs'],
    },
  },
  shajgoj: {
    code: 'shajgoj',
    name: 'Shajgoj',
    displayName: 'Shajgoj Stock & Sales Tracker',
    singleStorefront: true,
    defaultVendorName: 'Unilever Flagship Store',
    columnAliases: {
      productId: ['ProductId', 'Product ID', 'ID', 'sku_id'],
      name: ['ProductName', 'Product Name', 'Name', 'Title'],
      sku: ['Sku', 'SKU', 'Item_Code', 'Barcode'],
      vendorName: ['VendorName', 'Vendor Name', 'Vendor'],
      currentStock: ['Current Stock', 'Stock', 'Inventory', 'Qty'],
      soldQty: [/^Sold\s*Qty/i, /^Total\s*Sold/i, 'Total QTY', 'sold_qty'],
      runRate: ['Run Rate', 'run_rate'],
      mrp: ['MRP', 'Price', 'Retail Price'],
      tp: ['TP', 'Selling Price', 'Cost'],
      stockValue: ['Stock value', 'Stock Value'],
      totalAmount: ['Total Amount', 'Total Sales', 'Revenue'],
    },
  },
  daraz: {
    code: 'daraz',
    name: 'dMart / Daraz',
    displayName: 'Daraz Stock & Sales Tracker',
    singleStorefront: true,
    defaultVendorName: 'Unilever Flagship Store',
    columnAliases: {
      productId: ['Seller SKU', 'Item ID', 'ProductId', 'Product ID'],
      name: ['Product Name', 'Item Name', 'Name', 'Title'],
      sku: ['Shop SKU', 'SKU', 'Item_Id'],
      vendorName: ['Seller', 'Store Name', 'Vendor Name'],
      currentStock: ['Stock', 'Current Stock', 'Quantity'],
      soldQty: [/^Units\s*Sold/i, /^Sold\s*Qty/i, 'Total QTY', 'sold_qty'],
      runRate: ['Run Rate', 'run_rate'],
      mrp: ['Price', 'MRP', 'Retail Price'],
      tp: ['Special Price', 'Selling Price', 'TP'],
      stockValue: ['Stock Value', 'Stock value'],
      totalAmount: ['Total Revenue', 'Total Sales', 'Total Amount'],
    },
  },
  foodi: {
    code: 'foodi',
    name: 'Foodi',
    displayName: 'Foodi Stock & Sales Tracker',
    singleStorefront: true,
    defaultVendorName: 'Unilever Flagship Store',
    columnAliases: {
      productId: ['SKU', 'sku', 'Item ID', 'Product ID'],
      name: ['Product Name', 'ProductName', 'Name', 'Title'],
      sku: ['SKU', 'sku', 'Item ID'],
      category: ['Category', 'category'],
      currentStock: ['Total Stock', 'total_stock', 'Stock', 'Current Stock'],
      soldQty: ['30 Day Sale Qty', '30 Day Sale', 'sold_qty', 'Sold Qty'],
      tp: ['TP', 'Unit Selling Price', 'tp'],
      mrp: ['MRP', 'Unit Price', 'mrp'],
      sellingPrice: ['Selling Price', 'selling_price', 'Special Price'],
      barcodes: ['Barcodes', 'barcodes', 'Barcode'],
    },
  },
}

export function getMarketplaceConfig(accountCode: string): MarketplaceAccountConfig {
  const code = (accountCode || '').toLowerCase().trim()
  if (MARKETPLACE_ACCOUNTS[code]) {
    return MARKETPLACE_ACCOUNTS[code]
  }
  // Fallback generic config
  return {
    code,
    name: code.charAt(0).toUpperCase() + code.slice(1),
    displayName: `${code.charAt(0).toUpperCase() + code.slice(1)} Marketplace Tracker`,
    singleStorefront: true,
    defaultVendorName: 'Flagship Store',
    columnAliases: MARKETPLACE_ACCOUNTS.othoba.columnAliases,
  }
}

export function cleanText(v: any): string {
  if (v == null) return ''
  return String(v).trim().replace(/\s+/g, ' ')
}

export function cleanNumeric(v: any): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') {
    return isNaN(v) ? 0 : v
  }
  if (typeof v === 'string') {
    const s = v.trim().replace(/,/g, '').replace(/[৳$€£]/g, '')
    // Ignore excel formulas or formula artifacts if any
    if (s.startsWith('=') || s.startsWith('#')) return 0
    const n = parseFloat(s)
    return isNaN(n) ? 0 : n
  }
  return 0
}

/**
 * Finds the actual row key that matches any alias pattern
 */
export function findMatchingColumnKey(
  availableKeys: string[],
  aliases: (string | RegExp)[]
): string | null {
  for (const alias of aliases) {
    if (typeof alias === 'string') {
      const lowerAlias = alias.toLowerCase().trim()
      const match = availableKeys.find(k => cleanText(k).toLowerCase() === lowerAlias)
      if (match) return match
    } else if (alias instanceof RegExp) {
      const match = availableKeys.find(k => alias.test(cleanText(k)))
      if (match) return match
    }
  }
  return null
}

/**
 * Normalizes a raw spreadsheet row into a canonical marketplace record
 */
export interface NormalizedMarketplaceRecord {
  source_product_id: string
  name: string
  sku: string | null
  vendor_name: string | null
  current_stock: number
  sold_qty: number
  run_rate: number | null
  mrp: number | null
  tp: number | null
  stock_value: number | null
  product_cost: number | null
  total_product_cost: number | null
  total_amount: number | null
  sub_order_refs: string | null
}

export function resolveMarketplaceColumns(
  sampleRow: Record<string, any>,
  config: MarketplaceAccountConfig
): Record<string, string | null> {
  const keys = Object.keys(sampleRow)
  const resolved: Record<string, string | null> = {}
  for (const [field, aliases] of Object.entries(config.columnAliases)) {
    resolved[field] = findMatchingColumnKey(keys, aliases)
  }
  return resolved
}

export function normalizeMarketplaceRow(
  raw: Record<string, any>,
  columnMap: Record<string, string | null>,
  defaultVendor: string = 'Unilever Flagship Store'
): NormalizedMarketplaceRecord | null {
  const getVal = (field: string) => {
    const col = columnMap[field]
    return col ? raw[col] : undefined
  }

  // Extract primary identifier
  let productId = cleanText(getVal('productId'))
  const sku = cleanText(getVal('sku')) || null
  const name = cleanText(getVal('name'))

  // If ProductId is missing but SKU exists, fall back to SKU
  if (!productId && sku) {
    productId = sku
  }

  // Must have at least an ID or a Name to be a valid product row
  if (!productId && !name) {
    return null
  }
  if (!productId) {
    // Generate deterministic hash from name if ID is somehow blank
    productId = `GEN-${Math.abs(hashString(name))}`
  }

  const currentStock = cleanNumeric(getVal('currentStock'))
  const soldQty = cleanNumeric(getVal('soldQty'))
  let runRate: number | null = getVal('runRate') !== undefined ? cleanNumeric(getVal('runRate')) : null
  const mrp: number | null = getVal('mrp') !== undefined ? cleanNumeric(getVal('mrp')) : null
  const tp: number | null = getVal('tp') !== undefined ? cleanNumeric(getVal('tp')) : null
  let stockValue: number | null = getVal('stockValue') !== undefined ? cleanNumeric(getVal('stockValue')) : null
  const productCost: number | null = getVal('productCost') !== undefined ? cleanNumeric(getVal('productCost')) : null
  const totalProductCost: number | null = getVal('totalProductCost') !== undefined ? cleanNumeric(getVal('totalProductCost')) : null
  let totalAmount: number | null = getVal('totalAmount') !== undefined ? cleanNumeric(getVal('totalAmount')) : null
  const subOrderRefs: string | null = cleanText(getVal('subOrderRefs')) || null

  // If stock value was not given or is 0 while stock and price exist, calculate it
  if (!stockValue && currentStock > 0 && (tp || mrp)) {
    stockValue = currentStock * (tp || mrp || 0)
  }

  // If total amount not given but sold qty and tp exist, calculate
  if (!totalAmount && soldQty > 0 && (tp || mrp)) {
    totalAmount = soldQty * (tp || mrp || 0)
  }

  // If run_rate not explicitly provided but sold_qty > 0, default to sold_qty / 30
  if (runRate == null && soldQty > 0) {
    runRate = Math.round((soldQty / 30) * 1000) / 1000
  }

  const vendor = cleanText(getVal('vendorName')) || defaultVendor

  return {
    source_product_id: productId,
    name: name || `Product ${productId}`,
    sku: sku || productId,
    vendor_name: vendor,
    current_stock: currentStock,
    sold_qty: soldQty,
    run_rate: runRate,
    mrp: mrp != null && mrp > 0 ? mrp : null,
    tp: tp != null && tp > 0 ? tp : null,
    stock_value: stockValue != null && stockValue > 0 ? stockValue : null,
    product_cost: productCost != null && productCost > 0 ? productCost : null,
    total_product_cost: totalProductCost != null && totalProductCost > 0 ? totalProductCost : null,
    total_amount: totalAmount != null && totalAmount > 0 ? totalAmount : null,
    sub_order_refs: subOrderRefs,
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

/**
 * Deduce readable period label and as-of date from a sheet name or file name
 * e.g. "September-Sales & Stock Report" -> { periodLabel: "September 2026", date: "2026-09-21" }
 */
export function detectSheetPeriod(sheetName: string, fileName?: string): {
  periodLabel: string
  asOfDate: string
} {
  const text = `${sheetName} ${fileName || ''}`.toLowerCase()
  const months = [
    { name: 'January', match: /jan/i, monthNum: '01', days: 31 },
    { name: 'February', match: /feb/i, monthNum: '02', days: 28 },
    { name: 'March', match: /mar/i, monthNum: '03', days: 31 },
    { name: 'April', match: /apr/i, monthNum: '04', days: 30 },
    { name: 'May', match: /may/i, monthNum: '05', days: 31 },
    { name: 'June', match: /jun/i, monthNum: '06', days: 30 },
    { name: 'July', match: /jul/i, monthNum: '07', days: 31 },
    { name: 'August', match: /aug/i, monthNum: '08', days: 31 },
    { name: 'September', match: /sep/i, monthNum: '09', days: 30 },
    { name: 'October', match: /oct/i, monthNum: '10', days: 31 },
    { name: 'November', match: /nov/i, monthNum: '11', days: 30 },
    { name: 'December', match: /dec/i, monthNum: '12', days: 31 },
  ]

  const matchedMonth = months.find(m => m.match.test(text)) || {
    name: 'Current Month',
    monthNum: String(new Date().getMonth() + 1).padStart(2, '0'),
    days: 30,
  }

  // Detect year (e.g. 2026 or 2025 or 2024 or '26)
  const yearMatch = text.match(/202[4-9]/) || text.match(/'?(2[4-9])\b/)
  let year = '2026'
  if (yearMatch) {
    year = yearMatch[0].length === 2 ? `20${yearMatch[0]}` : yearMatch[0].replace("'", '')
  }

  // Detect day number if in text like (1-21) or (21st September)
  const dayMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/) || text.match(/1-(\d{1,2})/)
  let day = String(matchedMonth.days).padStart(2, '0')
  if (dayMatch && parseInt(dayMatch[1], 10) <= 31) {
    day = String(parseInt(dayMatch[1], 10)).padStart(2, '0')
  }

  return {
    periodLabel: `${matchedMonth.name} ${year}`,
    asOfDate: `${year}-${matchedMonth.monthNum}-${day}`,
  }
}
