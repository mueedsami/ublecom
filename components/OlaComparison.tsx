'use client'
import { OlaDailyRow, labelFor, shortDate } from '@/lib/olaReport'

const ACCOUNT_ORDER=['shajgoj','othoba','daraz','arogga','shwapno','foodi']
const BRANCH_ORDER=['Bashundhara','Dhanmondi','Gulshan','Gulshan 2','Mirpur 02','Mirpur 03','Mogbazar','Mohammadpur','Rampura','Uttara','Wari']
function rank(label:string,code:string,location?:string|null){
  if(code==='pandamart') return 100+(BRANCH_ORDER.indexOf(location||'')<0?99:BRANCH_ORDER.indexOf(location||''))
  const i=ACCOUNT_ORDER.indexOf(code); return i<0?50:i
}

export default function OlaComparison({rows}:{rows:OlaDailyRow[]}){
  const dates=Array.from(new Set(rows.map(r=>r.snapshot_date))).sort()
  const keyed=new Map<string,{label:string;code:string;location?:string|null;values:Map<string,number>}>()
  for(const r of rows){
    const label=labelFor(r), key=`${r.account_code}|${r.location_name||''}`
    if(!keyed.has(key)) keyed.set(key,{label,code:r.account_code,location:r.location_name,values:new Map()})
    keyed.get(key)!.values.set(r.snapshot_date,r.ola_pct)
  }
  const groups=Array.from(keyed.values()).sort((a,b)=>rank(a.label,a.code,a.location)-rank(b.label,b.code,b.location)||a.label.localeCompare(b.label))
  const dateAvgs=new Map<string,number>()
  for(const d of dates){
    const vals=groups.map(g=>g.values.get(d)).filter((v):v is number=>v!=null)
    dateAvgs.set(d,vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0)
  }
  const allGroupAvgs=groups.map(g=>{
    const vals=dates.map(d=>g.values.get(d)).filter((v):v is number=>v!=null)
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0
  })
  const overall=allGroupAvgs.length?allGroupAvgs.reduce((a,b)=>a+b,0)/allGroupAvgs.length:0

  return <div className="report-card">
    <div className="report-heading"><div><div className="eyebrow">Weekly / Range Summary</div><h2>OLA Comparison</h2></div><div className="report-date">{dates.length} reporting day{dates.length===1?'':'s'}</div></div>
    {dates.length===0?<div className="empty">No OLA history in this date range.</div>:<div className="table-wrap"><table className="report-table comparison-table">
      <thead><tr><th>Comparison</th>{dates.map(d=><th className="num" key={d}>{shortDate(d)}</th>)}<th className="num">Avg</th></tr></thead>
      <tbody>{groups.map((g,i)=>{
        const vals=dates.map(d=>g.values.get(d)).filter((v):v is number=>v!=null)
        const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0
        return <tr key={`${g.label}-${i}`}><td>{g.label}</td>{dates.map(d=><td className="num" key={d}>{g.values.has(d)?`${g.values.get(d)!.toFixed(0)}%`:'—'}</td>)}<td className="num strong">{avg.toFixed(0)}%</td></tr>
      })}</tbody>
      <tfoot><tr><td>Average OLA Score</td>{dates.map(d=><td className="num" key={d}>{dateAvgs.get(d)!.toFixed(0)}%</td>)}<td className="num">{overall.toFixed(0)}%</td></tr></tfoot>
    </table></div>}
  </div>
}
