
'use client'
import {useState} from 'react'
import Header from '@/components/Header'
import {searchStockProducts,getStockHistory} from '@/lib/stockTracking'

export default function Page(){
 const [q,setQ]=useState('')
 const [products,setProducts]=useState<any[]>([])
 const [selected,setSelected]=useState('')
 const [selectedId,setSelectedId]=useState('')
 const [history,setHistory]=useState<any>(null)

 async function search(){
  setProducts(await searchStockProducts(q))
 }
 async function open(p:any){
  setSelected(p.basepack)
  setSelectedId(p.id)
  setHistory(await getStockHistory(p.id,p.basepack))
 }

 return <>
 <Header eyebrow="Stock Tracking" title="Product availability timeline" subtitle="Search any basepack and see retailer-wise availability history."/>

 <div className="card">
  <div className="section-title"><h2>Search Product</h2></div>
  <div style={{display:'flex',gap:10}}>
   <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search basepack, SKU, brand..." style={{flex:1,padding:12,borderRadius:10,background:'#0e1628',border:'1px solid var(--border)',color:'white'}}/>
   <button onClick={search} className="pill">Search</button>
  </div>
  {products.map((p,i)=><div key={i} onClick={()=>open(p)} style={{padding:12,cursor:'pointer',borderBottom:'1px solid var(--border)'}}>
   {p.basepack} <span style={{color:'var(--muted)'}}>({p.brand})</span>
  </div>)}
 </div>

 {history&&<div className="card" style={{marginTop:16}}>
  <div className="section-title"><h2>{selected}</h2><span>Availability timeline</span></div>
  <div className="table-wrap">
   <table className="table">
    <thead><tr><th>Account</th><th>Average</th>{history.days.map((d:string)=><th key={d}>{d}</th>)}</tr></thead>
    <tbody>
    {history.rows.map((r:any,i:number)=><tr key={i}>
      <td>{r.account}</td><td>{r.avg}%</td>
      {r.status.map((s:number,j:number)=><td key={j}><span className={s?'status ok':'status bad'}>{s?'In stock':'Out'}</span></td>)}
    </tr>)}
    </tbody>
   </table>
  </div>
 </div>}
 </>
}
