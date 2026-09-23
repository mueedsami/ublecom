import { demoMode, supabase } from './supabase'

export type OlaDailyRow = {
  snapshot_date: string
  account_id?: string
  account_code: string
  account_name: string
  location_id?: string | null
  location_name?: string | null
  active_sku: number
  available: number
  nola: number
  ola_pct: number
}

export type OlaExplorerRow = {
  account_code: string
  account_name: string
  location_name: string | null
  business_unit: string | null
  category: string | null
  format: string | null
  brand: string | null
  basepack_id: string
  basepack: string
  available_count: number
  observation_count: number
  ola_pct: number
}


export type OlaExplorerDailyRow = OlaExplorerRow & {
  snapshot_date: string
}

const demoDaily: OlaDailyRow[] = [
  {snapshot_date:'2026-09-20',account_code:'shajgoj',account_name:'Shajgoj',location_name:null,active_sku:142,available:100,nola:42,ola_pct:70.4},
  {snapshot_date:'2026-09-20',account_code:'arogga',account_name:'Arogga',location_name:null,active_sku:182,available:169,nola:13,ola_pct:92.9},
  {snapshot_date:'2026-09-20',account_code:'daraz',account_name:'dMart / Daraz',location_name:null,active_sku:184,available:149,nola:35,ola_pct:81.0},
]

export async function getOlaDates(limit=120): Promise<string[]> {
  if (demoMode || !supabase) return ['2026-09-20']
  const {data,error}=await supabase.from('v_ola_dates').select('snapshot_date').limit(limit)
  if(error) throw error
  return (data||[]).map((r:any)=>String(r.snapshot_date))
}

export async function getOlaDailySummary(date:string): Promise<OlaDailyRow[]> {
  if (demoMode || !supabase) return demoDaily.filter(r=>r.snapshot_date===date)
  const {data,error}=await supabase
    .from('v_ola_daily_summary')
    .select('*')
    .eq('snapshot_date',date)
  if(error) throw error
  return (data||[]).map((r:any)=>({
    ...r,
    active_sku:Number(r.active_sku||0),
    available:Number(r.available||0),
    nola:Number(r.nola||0),
    ola_pct:Number(r.ola_pct||0),
  }))
}

export async function getOlaComparison(startDate:string,endDate:string): Promise<OlaDailyRow[]> {
  if (demoMode || !supabase) return demoDaily
  const {data,error}=await supabase
    .from('v_ola_daily_summary')
    .select('*')
    .gte('snapshot_date',startDate)
    .lte('snapshot_date',endDate)
    .order('snapshot_date',{ascending:true})
  if(error) throw error
  return (data||[]).map((r:any)=>({
    ...r,
    active_sku:Number(r.active_sku||0),
    available:Number(r.available||0),
    nola:Number(r.nola||0),
    ola_pct:Number(r.ola_pct||0),
  }))
}

export async function getOlaExplorer(startDate:string,endDate:string): Promise<OlaExplorerRow[]> {
  if (demoMode || !supabase) return []
  const out:any[]=[]
  const pageSize=1000
  for(let from=0;;from+=pageSize){
    const to=from+pageSize-1
    const {data,error}=await supabase
      .rpc('ola_explorer',{p_start_date:startDate,p_end_date:endDate})
      .range(from,to)
    if(error) throw error
    const rows=data||[]
    out.push(...rows)
    if(rows.length<pageSize) break
  }
  return out.map((r:any)=>({
    ...r,
    available_count:Number(r.available_count||0),
    observation_count:Number(r.observation_count||0),
    ola_pct:Number(r.ola_pct||0),
  }))
}


export async function getOlaExplorerDaily(startDate:string,endDate:string): Promise<OlaExplorerDailyRow[]> {
  if (demoMode || !supabase) return []
  const out:any[]=[]
  const pageSize=1000
  for(let from=0;;from+=pageSize){
    const to=from+pageSize-1
    const {data,error}=await supabase
      .rpc('ola_explorer_daily',{p_start_date:startDate,p_end_date:endDate})
      .range(from,to)
    if(error) throw error
    const rows=data||[]
    out.push(...rows)
    if(rows.length<pageSize) break
  }
  return out.map((r:any)=>({
    ...r,
    available_count:Number(r.available_count||0),
    observation_count:Number(r.observation_count||0),
    ola_pct:Number(r.ola_pct||0),
  }))
}

export function labelFor(row:{account_name:string;account_code?:string;location_name?:string|null}){
  const base=row.account_code==='daraz'?'dMart':row.account_name
  return row.location_name ? `${base} ${row.location_name}` : base
}

export function addDays(date:string,delta:number){
  const d=new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate()+delta)
  return d.toISOString().slice(0,10)
}

export function niceDate(date:string){
  if(!date) return ''
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))
}

export function shortDate(date:string){
  if(!date) return ''
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))
}
