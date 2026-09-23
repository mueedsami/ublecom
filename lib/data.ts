import { demoMode, supabase } from './supabase'
import { demoAccounts, demoCpp, demoHeat, demoNola, demoSos, demoTrend } from './demo'

export async function getOverview(){
  if(demoMode || !supabase) return {accounts:demoAccounts,trend:demoTrend,nola:demoNola,heat:demoHeat,cpp:demoCpp,sos:demoSos,freshness:demoAccounts.map(a=>({account_name:a.account_name,last_observed_at:new Date().toISOString()}))}
  const [accounts,nola,heat,cpp,sos,freshness,trend] = await Promise.all([
    supabase.from('v_account_ola_today').select('*').order('ola_pct',{ascending:false}),
    supabase.from('v_nola_today').select('*').limit(30),
    supabase.from('v_brand_account_today').select('*'),
    supabase.from('v_cpp_latest').select('*'),
    supabase.from('v_sos_latest').select('*').limit(200),
    supabase.from('v_data_freshness').select('*'),
    supabase.from('availability_snapshots').select('snapshot_date,available').order('snapshot_date',{ascending:true}).limit(5000),
  ])
  const byDate:Record<string,{n:number,yes:number}>={}
  for(const r of trend.data||[]){ const d=(r as any).snapshot_date; byDate[d]??={n:0,yes:0}; byDate[d].n++; if((r as any).available) byDate[d].yes++ }
  const trendRows=Object.entries(byDate).slice(-30).map(([date,v])=>({date,ola:Math.round(1000*v.yes/v.n)/10}))
  const heatRows:any[]=[]; const brands=new Map<string,any>()
  for(const r of heat.data||[]){ const x:any=r; if(!brands.has(x.brand)) brands.set(x.brand,{brand:x.brand}); brands.get(x.brand)[x.account_code]=Number(x.ola_pct) }
  brands.forEach(v=>heatRows.push(v))
  return {accounts:accounts.data||[],nola:nola.data||[],heat:heatRows,cpp:cpp.data||[],sos:sos.data||[],freshness:freshness.data||[],trend:trendRows}
}
