'use client'
import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import { CheckSquare } from 'lucide-react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import OlaDailySummary from '@/components/OlaDailySummary'
import OlaComparison from '@/components/OlaComparison'
import OlaExplorer from '@/components/OlaExplorer'
import {addDays,getOlaComparison,getOlaDailySummary,getOlaDates,getOlaExplorer,getOlaExplorerDaily,niceDate,OlaDailyRow,OlaExplorerDailyRow,OlaExplorerRow} from '@/lib/olaReport'

type Tab='daily'|'comparison'|'explorer'

export default function Page(){
  const [tab,setTab]=useState<Tab>('daily')
  const [dates,setDates]=useState<string[]>([])
  const [dailyDate,setDailyDate]=useState('')
  const [comparisonStart,setComparisonStart]=useState('')
  const [comparisonEnd,setComparisonEnd]=useState('')
  const [explorerStart,setExplorerStart]=useState('')
  const [explorerEnd,setExplorerEnd]=useState('')
  const [dailyRows,setDailyRows]=useState<OlaDailyRow[]>([])
  const [comparisonRows,setComparisonRows]=useState<OlaDailyRow[]>([])
  const [explorerRows,setExplorerRows]=useState<OlaExplorerRow[]>([])
  const [explorerDailyRows,setExplorerDailyRows]=useState<OlaExplorerDailyRow[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{(async()=>{
    try{
      setLoading(true)
      const d=await getOlaDates()
      setDates(d)
      const latest=d[0]||''
      setDailyDate(latest)
      if(latest){
        const start=addDays(latest,-6)
        setComparisonStart(start);setComparisonEnd(latest)
        setExplorerStart(start);setExplorerEnd(latest)
        setDailyRows(await getOlaDailySummary(latest))
      }
    }catch(e:any){setError(e?.message||String(e))}finally{setLoading(false)}
  })()},[])

  useEffect(()=>{if(!dailyDate)return;(async()=>{try{setLoading(true);setError('');setDailyRows(await getOlaDailySummary(dailyDate))}catch(e:any){setError(e?.message||String(e))}finally{setLoading(false)}})()},[dailyDate])
  useEffect(()=>{if(tab!=='comparison'||!comparisonStart||!comparisonEnd)return;(async()=>{try{setLoading(true);setError('');setComparisonRows(await getOlaComparison(comparisonStart,comparisonEnd))}catch(e:any){setError(e?.message||String(e))}finally{setLoading(false)}})()},[tab,comparisonStart,comparisonEnd])
  useEffect(()=>{if(tab!=='explorer'||!explorerStart||!explorerEnd)return;(async()=>{try{setLoading(true);setError('');const [summary,daily]=await Promise.all([getOlaExplorer(explorerStart,explorerEnd),getOlaExplorerDaily(explorerStart,explorerEnd)]);setExplorerRows(summary);setExplorerDailyRows(daily)}catch(e:any){setError(e?.message||String(e))}finally{setLoading(false)}})()},[tab,explorerStart,explorerEnd])

  const latest=dates[0]||''
  const currentLabel=useMemo(()=>latest?`Latest successful OLA: ${niceDate(latest)}`:'No OLA history yet',[latest])

  function useLatest7(which:'comparison'|'explorer'){
    if(!latest)return
    const s=addDays(latest,-6)
    if(which==='comparison'){setComparisonStart(s);setComparisonEnd(latest)}else{setExplorerStart(s);setExplorerEnd(latest)}
  }

  return <>
    <Header eyebrow="Online Availability" title="Complete OLA Report" subtitle="Daily summary, week comparison and a modern interactive analysis workspace — directly from Supabase."/>
    <div className="report-topline"><span>{currentLabel}</span><span>View mode · no raw file required</span></div>

    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:16}}>
      <div className="report-tabs" role="tablist" style={{margin:0}}>
        <button className={tab==='daily'?'active':''} onClick={()=>setTab('daily')}>Daily Summary</button>
        <button className={tab==='comparison'?'active':''} onClick={()=>setTab('comparison')}>Weekly Comparison</button>
        <button className={tab==='explorer'?'active':''} onClick={()=>setTab('explorer')}>Analysis Explorer</button>
      </div>
      <Link href="/checker" className="secondary-btn" style={{borderColor:'#34547e',background:'rgba(47,125,255,0.12)',color:'#8eb8ff',display:'inline-flex',alignItems:'center',gap:7,padding:'9px 13px',borderRadius:10}}>
        <CheckSquare size={14}/>
        <span>Open Shelf & SKU Checker →</span>
      </Link>
    </div>

    {tab==='daily'&&<div className="report-toolbar">
      <div><label>Report date</label><select value={dailyDate} onChange={e=>setDailyDate(e.target.value)}>{dates.map(d=><option key={d} value={d}>{niceDate(d)}</option>)}</select></div>
      <div className="toolbar-note">Shows every account, with Pandamart broken down branch by branch. Grand Total is weighted by tracked scopes.</div>
    </div>}

    {tab==='comparison'&&<div className="report-toolbar">
      <div><label>From</label><input type="date" value={comparisonStart} max={comparisonEnd||latest} onChange={e=>setComparisonStart(e.target.value)}/></div>
      <div><label>To</label><input type="date" value={comparisonEnd} min={comparisonStart} max={latest} onChange={e=>setComparisonEnd(e.target.value)}/></div>
      <button className="secondary-btn" onClick={()=>useLatest7('comparison')}>Latest 7 days</button>
      <div className="toolbar-note">The Avg column follows your Excel comparison logic: simple average of the displayed daily percentages.</div>
    </div>}

    {tab==='explorer'&&<div className="report-toolbar">
      <div><label>From</label><input type="date" value={explorerStart} max={explorerEnd||latest} onChange={e=>setExplorerStart(e.target.value)}/></div>
      <div><label>To</label><input type="date" value={explorerEnd} min={explorerStart} max={latest} onChange={e=>setExplorerEnd(e.target.value)}/></div>
      <button className="secondary-btn" onClick={()=>useLatest7('explorer')}>Latest 7 days</button>
      <div className="toolbar-note">The explorer now uses compact filters plus Matrix, Ranking, Trend and guided Drill views.</div>
    </div>}

    {error?<div className="card error-card"><strong>Could not load OLA report.</strong><div>{error}</div></div>:null}
    {loading?<Loading/>:null}
    {!loading&&!error&&tab==='daily'&&<OlaDailySummary date={dailyDate} rows={dailyRows}/>} 
    {!loading&&!error&&tab==='comparison'&&<OlaComparison rows={comparisonRows}/>} 
    {!loading&&!error&&tab==='explorer'&&<OlaExplorer rows={explorerRows} dailyRows={explorerDailyRows}/>} 
  </>
}
