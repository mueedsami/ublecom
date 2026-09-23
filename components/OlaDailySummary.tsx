'use client'
import { OlaDailyRow, labelFor, niceDate } from '@/lib/olaReport'

const ACCOUNT_ORDER=['shajgoj','othoba','daraz','arogga','shwapno','foodi']
const BRANCH_ORDER=['Bashundhara','Dhanmondi','Gulshan','Gulshan 2','Mirpur 02','Mirpur 03','Mogbazar','Mohammadpur','Rampura','Uttara','Wari']

function rowRank(r:OlaDailyRow){
  if(r.account_code==='pandamart') return 100+(BRANCH_ORDER.indexOf(r.location_name||'')<0?99:BRANCH_ORDER.indexOf(r.location_name||''))
  const i=ACCOUNT_ORDER.indexOf(r.account_code)
  return i<0?50:i
}

export default function OlaDailySummary({date,rows}:{date:string;rows:OlaDailyRow[]}){
  const sorted=[...rows].sort((a,b)=>rowRank(a)-rowRank(b)||labelFor(a).localeCompare(labelFor(b)))
  const active=sorted.reduce((s,r)=>s+r.active_sku,0)
  const available=sorted.reduce((s,r)=>s+r.available,0)
  const pct=active?available*100/active:0
  return <div className="report-card">
    <div className="report-heading">
      <div><div className="eyebrow">Daily OLA</div><h2>OLA {new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))}</h2></div>
      <div className="report-date">{niceDate(date)}</div>
    </div>
    <div className="table-wrap"><table className="report-table daily-table">
      <thead><tr><th>Account</th><th className="num">Active SKU</th><th className="num">Available</th><th className="num">Percentage</th></tr></thead>
      <tbody>
        {sorted.map((r,i)=><tr key={`${r.account_code}-${r.location_name||'all'}-${i}`}>
          <td>{labelFor(r)}</td><td className="num">{r.active_sku}</td><td className="num">{r.available}</td><td className="num strong">{r.ola_pct.toFixed(0)}%</td>
        </tr>)}
      </tbody>
      <tfoot><tr><td>Grand Total</td><td className="num">{active}</td><td className="num">{available}</td><td className="num">{pct.toFixed(0)}%</td></tr></tfoot>
    </table></div>
  </div>
}
