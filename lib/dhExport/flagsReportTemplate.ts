import { DhFlag, DhFlagsSummary, DhFlagSeverity, DhFlagType } from '@/lib/dhFlags'

export interface PdfReportOptions {
  scopeName?: string
  dateStr?: string
  filters?: {
    severity?: string
    flagType?: string
    status?: string
    store?: string
    search?: string
  }
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  sales_decline: { label: 'Sales Cliff / Decline', color: '#ff6673', bg: 'rgba(255, 102, 115, 0.15)' },
  stockout_risk: { label: 'Stockout Risk', color: '#ffbf4b', bg: 'rgba(255, 191, 75, 0.15)' },
  distribution_imbalance: { label: 'Distribution Imbalance', color: '#ff9f43', bg: 'rgba(255, 159, 67, 0.15)' },
  dc_stuck: { label: 'DC-Stuck Stock', color: '#2f7dff', bg: 'rgba(47, 125, 255, 0.15)' },
  dead_stock: { label: 'Dead Stock Network-Wide', color: '#93a4c3', bg: 'rgba(147, 164, 195, 0.15)' },
  store_health: { label: 'Store Health OOS Risk', color: '#e056fd', bg: 'rgba(224, 86, 253, 0.15)' },
}

/**
 * Generates an inline SVG sparkline path from daily sales numbers.
 */
function renderInlineSparklineSvg(sparkline?: Array<{ date: string; sold_qty: number }>, strokeColor = '#32d1c3'): string {
  if (!sparkline || sparkline.length < 2) return ''
  const values = sparkline.map((p) => p.sold_qty || 0)
  const max = Math.max(...values, 1)
  const width = 120
  const height = 30
  const pad = 2

  const points = values.map((val, idx) => {
    const x = pad + (idx / (values.length - 1)) * (width - 2 * pad)
    const y = height - pad - (val / max) * (height - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const polylineStr = points.join(' ')
  const lastPoint = points[points.length - 1]
  const firstPoint = points[0]
  const areaPath = `M ${firstPoint} L ${polylineStr} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`

  return `
    <div class="sparkline-wrap">
      <div class="sparkline-title">30-DAY VELOCITY TREND</div>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="sparkGrad_${strokeColor.replace('#', '')}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#sparkGrad_${strokeColor.replace('#', '')})" />
        <polyline fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${polylineStr}" />
      </svg>
    </div>
  `
}

/**
 * Renders the HTML template matching the Pandamart DH Command Center dark cyber aesthetic.
 */
export function renderFlagsReportHtml(
  flags: DhFlag[],
  options: PdfReportOptions = {}
): string {
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const critCount = flags.filter((f) => f.severity === 'critical').length
  const warnCount = flags.filter((f) => f.severity === 'warning').length
  const infoCount = flags.filter((f) => f.severity === 'info').length

  const activeSev = options.filters?.severity?.toLowerCase() || 'all'
  let accentColor = '#2f7dff'
  if (activeSev === 'critical') accentColor = '#ff4757'
  else if (activeSev === 'warning') accentColor = '#ffa502'

  const scopeLabel = options.scopeName || (
    activeSev !== 'all' ? `${activeSev.toUpperCase()} PRIORITY FLAGS` : 'ALL OPERATIONAL FLAGS'
  )

  const cardsHtml = flags.map((flag, index) => {
    const m = flag.metrics || {}
    const cfg = TYPE_CONFIG[flag.flag_type] || { label: flag.flag_type, color: '#2f7dff', bg: 'rgba(47, 125, 255, 0.15)' }
    const sevColor = flag.severity === 'critical' ? '#ff4757' : flag.severity === 'warning' ? '#ffa502' : '#2f7dff'
    const statusColor = flag.status === 'resolved' ? '#2ed573' : flag.status === 'acknowledged' ? '#ffa502' : '#ff4757'

    const sku = flag.item?.dh_sku || m.dh_sku || 'N/A'
    const name = flag.item?.dh_name || flag.item?.basepacks?.name || flag.title
    const brand = flag.item?.basepacks?.brand || ''
    const store = flag.store?.display_name || (flag.dh_store_id ? `Store ${flag.dh_store_id}` : 'Network-Wide (17 Stores + DC)')

    // Sparkline SVG
    const sparklineSvg = renderInlineSparklineSvg(flag.sparkline || m.sales_trend_30d, sevColor)

    // Build metric tags
    const metricTags: string[] = []
    if (m.days_of_cover != null) {
      metricTags.push(`
        <div class="metric-pill ${m.days_of_cover < 3 ? 'critical' : m.days_of_cover < 7 ? 'warning' : ''}">
          <span class="m-label">Days Cover</span>
          <span class="m-val">${Number(m.days_of_cover).toFixed(1)}d</span>
        </div>
      `)
    }
    if (m.total_stock != null) {
      metricTags.push(`
        <div class="metric-pill">
          <span class="m-label">Total Stock</span>
          <span class="m-val">${Number(m.total_stock).toLocaleString()}</span>
        </div>
      `)
    }
    if (m.sold_qty_30d != null) {
      metricTags.push(`
        <div class="metric-pill">
          <span class="m-label">30d Sold</span>
          <span class="m-val">${Number(m.sold_qty_30d).toLocaleString()}</span>
        </div>
      `)
    }
    if (m.dc_qty != null && m.dc_qty > 0) {
      metricTags.push(`
        <div class="metric-pill">
          <span class="m-label">DC Stock</span>
          <span class="m-val">${Number(m.dc_qty).toLocaleString()}</span>
        </div>
      `)
    }
    if (m.store_count_instock != null) {
      metricTags.push(`
        <div class="metric-pill">
          <span class="m-label">Stores In-Stock</span>
          <span class="m-val">${m.store_count_instock}/16</span>
        </div>
      `)
    }
    if (m.drop_pct != null) {
      metricTags.push(`
        <div class="metric-pill critical">
          <span class="m-label">Drop %</span>
          <span class="m-val">-${m.drop_pct}%</span>
        </div>
      `)
    }
    if (m.oos_pct != null) {
      metricTags.push(`
        <div class="metric-pill ${m.oos_pct > 30 ? 'critical' : 'warning'}">
          <span class="m-label">Store OOS</span>
          <span class="m-val">${m.oos_pct}%</span>
        </div>
      `)
    }
    if (m.zero_count != null) {
      metricTags.push(`
        <div class="metric-pill">
          <span class="m-label">Zero Stock SKUs</span>
          <span class="m-val">${m.zero_count}</span>
        </div>
      `)
    }

    return `
      <div class="flag-card" style="border-left-color: ${sevColor};">
        <div class="flag-card-header">
          <div class="flag-badges">
            <span class="sev-badge" style="background: ${sevColor}; color: #080d1a;">
              ${flag.severity.toUpperCase()}
            </span>
            <span class="type-badge" style="background: ${cfg.bg}; color: ${cfg.color}; border: 1px solid ${cfg.color}40;">
              ${cfg.label}
            </span>
            <span class="status-badge" style="border-color: ${statusColor}; color: ${statusColor};">
              ● ${flag.status.toUpperCase()}
            </span>
          </div>
          <div class="flag-timestamp">
            DET: ${flag.first_detected_at ? flag.first_detected_at.slice(0, 10) : 'Active'}
          </div>
        </div>

        <div class="flag-product-row">
          <div class="product-sku">${sku}</div>
          <div class="product-name">${name}</div>
          ${brand ? `<div class="product-brand">${brand}</div>` : ''}
          <div class="product-store">📍 ${store}</div>
        </div>

        <div class="flag-message">
          ${flag.message}
        </div>

        <div class="flag-card-footer">
          <div class="metric-strip">
            ${metricTags.join('')}
          </div>
          ${sparklineSvg}
        </div>
      </div>
      ${index < flags.length - 1 ? `
        <div class="circuit-divider">
          <svg width="100%" height="8" viewBox="0 0 800 8">
            <line x1="0" y1="4" x2="800" y2="4" stroke="rgba(47, 125, 255, 0.15)" stroke-width="1" />
            <circle cx="20" cy="4" r="2.5" fill="#2f7dff" opacity="0.6" />
            <circle cx="780" cy="4" r="2.5" fill="#2f7dff" opacity="0.6" />
          </svg>
        </div>
      ` : ''}
    `
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pandamart DH Command Center — Operational Flag Dossier</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
      @bottom-right {
        content: counter(page) " / " counter(pages);
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: #070a13;
      color: #e2e8f0;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }

    /* CYBER COMMAND HEADER */
    .cyber-header {
      background: linear-gradient(180deg, #0e1629 0%, #080d1a 100%);
      border: 1px solid #1c2b48;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 14px;
      position: relative;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    .cyber-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .system-title {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #38bdf8;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .main-heading {
      font-family: 'Consolas', 'Segoe UI', monospace;
      font-size: 18px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 0.5px;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .scope-badge {
      font-family: 'Consolas', monospace;
      font-size: 10px;
      font-weight: 700;
      color: ${accentColor};
      background: ${accentColor}18;
      border: 1px solid ${accentColor}50;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 1px;
    }

    .meta-block {
      text-align: right;
      font-family: 'Consolas', monospace;
      font-size: 9px;
      color: #94a3b8;
      line-height: 1.4;
    }

    .glowing-bar {
      height: 2px;
      background: linear-gradient(90deg, ${accentColor} 0%, #2f7dff 50%, transparent 100%);
      box-shadow: 0 0 10px ${accentColor};
      margin-top: 12px;
      border-radius: 2px;
    }

    /* KPI STAT STRIP */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }

    .kpi-card {
      background: #0d1527;
      border: 1px solid #1a2845;
      border-radius: 6px;
      padding: 10px 14px;
    }

    .kpi-card.critical {
      border-left: 3px solid #ff4757;
      background: linear-gradient(135deg, rgba(255, 71, 87, 0.08) 0%, #0d1527 100%);
    }

    .kpi-card.warning {
      border-left: 3px solid #ffa502;
      background: linear-gradient(135deg, rgba(255, 165, 2, 0.08) 0%, #0d1527 100%);
    }

    .kpi-card.info {
      border-left: 3px solid #2f7dff;
      background: linear-gradient(135deg, rgba(47, 125, 255, 0.08) 0%, #0d1527 100%);
    }

    .kpi-card.total {
      border-left: 3px solid #38bdf8;
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, #0d1527 100%);
    }

    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-value {
      font-family: 'Consolas', monospace;
      font-size: 20px;
      font-weight: 900;
      margin-top: 2px;
      color: #ffffff;
    }

    .kpi-value.critical { color: #ff6673; text-shadow: 0 0 10px rgba(255, 102, 115, 0.4); }
    .kpi-value.warning { color: #ffbf4b; text-shadow: 0 0 10px rgba(255, 191, 75, 0.4); }
    .kpi-value.info { color: #38bdf8; text-shadow: 0 0 10px rgba(56, 189, 248, 0.4); }

    /* FLAG CARDS */
    .flag-card {
      background: #0d1527;
      border: 1px solid #1a2845;
      border-left: 4px solid #2f7dff;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 6px;
      page-break-inside: avoid;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }

    .flag-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .flag-badges {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sev-badge {
      font-family: 'Consolas', monospace;
      font-size: 8.5px;
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }

    .type-badge {
      font-family: 'Consolas', monospace;
      font-size: 8.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 3px;
    }

    .status-badge {
      font-family: 'Consolas', monospace;
      font-size: 8.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      border: 1px solid;
    }

    .flag-timestamp {
      font-family: 'Consolas', monospace;
      font-size: 8.5px;
      color: #64748b;
    }

    .flag-product-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }

    .product-sku {
      font-family: 'Consolas', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }

    .product-name {
      font-size: 12px;
      font-weight: 800;
      color: #f1f5f9;
    }

    .product-brand {
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
    }

    .product-store {
      font-size: 10px;
      color: #32d1c3;
      margin-left: auto;
      font-weight: 600;
    }

    .flag-message {
      font-size: 10.5px;
      color: #cbd5e1;
      margin-bottom: 10px;
      line-height: 1.45;
      background: rgba(15, 23, 42, 0.6);
      padding: 8px 10px;
      border-radius: 4px;
      border-left: 2px solid rgba(255, 255, 255, 0.1);
    }

    .flag-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .metric-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .metric-pill {
      background: #090e1c;
      border: 1px solid #1a2845;
      padding: 3px 8px;
      border-radius: 4px;
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .metric-pill.critical {
      border-color: rgba(255, 71, 87, 0.4);
      background: rgba(255, 71, 87, 0.1);
    }

    .metric-pill.critical .m-val {
      color: #ff6673;
    }

    .metric-pill.warning {
      border-color: rgba(255, 165, 2, 0.4);
      background: rgba(255, 165, 2, 0.1);
    }

    .metric-pill.warning .m-val {
      color: #ffbf4b;
    }

    .m-label {
      font-size: 8px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .m-val {
      font-family: 'Consolas', monospace;
      font-size: 10px;
      font-weight: 800;
      color: #f8fafc;
    }

    .sparkline-wrap {
      text-align: right;
      flex-shrink: 0;
    }

    .sparkline-title {
      font-family: 'Consolas', monospace;
      font-size: 7.5px;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .circuit-divider {
      margin: 4px 0;
      opacity: 0.5;
    }

    /* FOOTER STAMP */
    .report-footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #1a2845;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Consolas', monospace;
      font-size: 8px;
      color: #64748b;
    }

    .stamp-badge {
      border: 1px solid rgba(255, 71, 87, 0.3);
      color: #ff6673;
      padding: 2px 6px;
      border-radius: 2px;
      font-weight: 700;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <!-- HEADER BANNER -->
  <div class="cyber-header">
    <div class="cyber-header-top">
      <div>
        <div class="system-title">PANDAMART DH OPERATIONAL COMMAND // UNILEVER BANGLADESH</div>
        <h1 class="main-heading">
          FLAG REPORT DOSSIER
          <span class="scope-badge">${scopeLabel}</span>
        </h1>
      </div>
      <div class="meta-block">
        <div>GENERATED: ${generatedAt}</div>
        <div>TOTAL FLAGS: ${flags.length}</div>
        <div>STATUS SCOPE: ${(options.filters?.status || 'OPEN').toUpperCase()}</div>
      </div>
    </div>
    <div class="glowing-bar"></div>
  </div>

  <!-- KPI STRIP -->
  <div class="kpi-strip">
    <div class="kpi-card total">
      <div class="kpi-label">Total Flags in Scope</div>
      <div class="kpi-value">${flags.length}</div>
    </div>
    <div class="kpi-card critical">
      <div class="kpi-label">Critical Action Required</div>
      <div class="kpi-value critical">${critCount}</div>
    </div>
    <div class="kpi-card warning">
      <div class="kpi-label">Warning Attention</div>
      <div class="kpi-value warning">${warnCount}</div>
    </div>
    <div class="kpi-card info">
      <div class="kpi-label">Catalog / Info</div>
      <div class="kpi-value info">${infoCount}</div>
    </div>
  </div>

  <!-- FLAG CARDS -->
  <div class="flags-container">
    ${cardsHtml || '<div style="padding:40px; text-align:center; color:#94a3b8;">No matching operational flags in this scope.</div>'}
  </div>

  <!-- FOOTER -->
  <div class="report-footer">
    <div>UNILEVER BANGLADESH DIGITAL SHELF COMMAND CENTER · DH DIRECT FEEDS</div>
    <div class="stamp-badge">CONFIDENTIAL — INTERNAL USE ONLY</div>
  </div>
</body>
</html>
`
}
