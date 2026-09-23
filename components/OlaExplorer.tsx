'use client'

import {useMemo,useState} from 'react'
import {
  ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, Filter, LayoutGrid,
  LineChart as LineChartIcon, RotateCcw, Route, Search, X
} from 'lucide-react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import {OlaExplorerDailyRow, OlaExplorerRow, shortDate} from '@/lib/olaReport'

type FilterKey='account_name'|'business_unit'|'category'|'format'|'brand'|'location_name'
type FilterState=Record<FilterKey,string[]>
type ExplorerView='matrix'|'ranking'|'trend'|'drill'
type RankDimension='business_unit'|'category'|'format'|'brand'|'basepack'
type MatrixDimension='business_unit'|'category'|'format'|'brand'
type TrendDimension='overall'|'account_name'|'category'|'format'|'brand'

const EMPTY:FilterState={account_name:[],business_unit:[],category:[],format:[],brand:[],location_name:[]}
const FILTER_LABELS:Record<FilterKey,string>={
  account_name:'Account',business_unit:'Business Unit',category:'Category',format:'Format',brand:'Brand',location_name:'Branch'
}
const DIM_LABELS:Record<RankDimension,string>={
  business_unit:'Business Unit',category:'Category',format:'Format',brand:'Brand',basepack:'Basepack'
}
const COLORS=['#32d1c3','#2f7dff','#44d17a','#ffbf4b','#b68cff','#ff7b9c']

function text(v:string|null|undefined){return (v||'Unassigned').trim()||'Unassigned'}
function pct(a:number,n:number){return n?a*100/n:0}
function accountLabel(r:{account_code:string;account_name:string;location_name?:string|null}){
  const base=r.account_code==='daraz'?'dMart':r.account_name
  return r.account_code==='pandamart'&&r.location_name ? `${base} · ${r.location_name}` : base
}
function tone(score:number){return score>=90?'excellent':score>=75?'good':score>=60?'watch':'risk'}
function applyFilters<T extends OlaExplorerRow|OlaExplorerDailyRow>(rows:T[],filters:FilterState,except?:FilterKey){
  return rows.filter(r=>(Object.keys(filters) as FilterKey[]).every(k=>{
    if(k===except||filters[k].length===0)return true
    return filters[k].includes(text(String(r[k]??'')))
  }))
}
function sumRows(rows:Array<{available_count:number;observation_count:number}>){
  const available=rows.reduce((s,r)=>s+r.available_count,0)
  const total=rows.reduce((s,r)=>s+r.observation_count,0)
  return {available,total,score:pct(available,total)}
}
function unique<T>(items:T[]){return Array.from(new Set(items))}

function Sparkline({values}:{values:number[]}){
  if(values.length<2)return <span className="spark-empty">—</span>
  const width=90,height=28,pad=3,min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min)
  const points=values.map((v,i)=>{
    const x=pad+(i*(width-pad*2))/Math.max(1,values.length-1)
    const y=height-pad-((v-min)/span)*(height-pad*2)
    return `${x},${y}`
  }).join(' ')
  return <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-label="Trend sparkline">
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

function FilterDropdown({name,options,selected,onChange}:{name:string;options:string[];selected:string[];onChange:(v:string[])=>void}){
  const [query,setQuery]=useState('')
  const visible=options.filter(o=>o.toLowerCase().includes(query.toLowerCase()))
  const summary=selected.length===0?'All':selected.length===1?selected[0]:`${selected.length} selected`
  return <details className={`filter-dropdown ${selected.length?'has-value':''}`}>
    <summary><span><small>{name}</small><strong>{summary}</strong></span><ChevronRight size={15}/></summary>
    <div className="filter-popover">
      <div className="filter-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${name.toLowerCase()}`}/></div>
      <div className="filter-popover-actions"><button onClick={()=>onChange([])}>All</button>{selected.length?<button onClick={()=>onChange([])}>Clear</button>:null}</div>
      <div className="filter-option-list">
        {visible.map(o=>{
          const checked=selected.includes(o)
          return <label key={o} className={checked?'checked':''}>
            <input type="checkbox" checked={checked} onChange={()=>onChange(checked?selected.filter(x=>x!==o):[...selected,o])}/>
            <span>{o}</span>
          </label>
        })}
        {!visible.length?<div className="filter-empty">No matches</div>:null}
      </div>
    </div>
  </details>
}

function FilterBar({rows,filters,onChange,onClear}:{rows:OlaExplorerRow[];filters:FilterState;onChange:(k:FilterKey,v:string[])=>void;onClear:()=>void}){
  const activeCount=(Object.keys(filters) as FilterKey[]).reduce((n,k)=>n+filters[k].length,0)
  return <>
    <div className="compact-filterbar">
      <div className="filterbar-title"><Filter size={16}/><span>Filters</span>{activeCount?<b>{activeCount}</b>:null}</div>
      {(Object.keys(filters) as FilterKey[]).map(k=>{
        const source=applyFilters(rows,filters,k)
        const options=unique(source.map(r=>text(String(r[k]??'')))).filter(v=>k!=='location_name'||v!=='Unassigned').sort((a,b)=>a.localeCompare(b))
        return <FilterDropdown key={k} name={FILTER_LABELS[k]} options={options} selected={filters[k]} onChange={v=>onChange(k,v)}/>
      })}
      {activeCount?<button className="clear-filter-btn" onClick={onClear}><RotateCcw size={14}/> Reset</button>:null}
    </div>
    {activeCount?<div className="filter-chips">
      {(Object.keys(filters) as FilterKey[]).flatMap(k=>filters[k].map(v=><button key={`${k}-${v}`} onClick={()=>onChange(k,filters[k].filter(x=>x!==v))}><span>{FILTER_LABELS[k]}:</span> {v}<X size={12}/></button>))}
    </div>:null}
  </>
}

function KpiStrip({rows,dailyRows}:{rows:OlaExplorerRow[];dailyRows:OlaExplorerDailyRow[]}){
  const {available,total,score}=sumRows(rows)
  const dates=unique(dailyRows.map(r=>r.snapshot_date)).sort()
  const latest=dates.at(-1),previous=dates.at(-2)
  const latestStats=latest?sumRows(dailyRows.filter(r=>r.snapshot_date===latest)):{available:0,total:0,score:0}
  const prevStats=previous?sumRows(dailyRows.filter(r=>r.snapshot_date===previous)):{available:0,total:0,score:0}
  const delta=previous?latestStats.score-prevStats.score:null
  const basepacks=new Set(rows.map(r=>r.basepack_id)).size
  return <div className="analysis-kpis">
    <div className="analysis-kpi primary-kpi"><span>Filtered OLA</span><strong>{score.toFixed(1)}%</strong><small>{delta===null?'Trend starts after 2 reporting days':<>{delta>=0?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {Math.abs(delta).toFixed(1)}pp vs previous day</>}</small></div>
    <div className="analysis-kpi"><span>Available scope-days</span><strong>{available.toLocaleString()}</strong><small>of {total.toLocaleString()} tracked</small></div>
    <div className="analysis-kpi"><span>NOLA scope-days</span><strong>{Math.max(0,total-available).toLocaleString()}</strong><small>within selected period</small></div>
    <div className="analysis-kpi"><span>Basepacks</span><strong>{basepacks.toLocaleString()}</strong><small>after current filters</small></div>
  </div>
}

function MatrixView({rows,onFocus}:{rows:OlaExplorerRow[];onFocus:(dim:MatrixDimension,label:string,column:string)=>void}){
  const [dimension,setDimension]=useState<MatrixDimension>('brand')
  const columns=unique(rows.map(accountLabel)).sort((a,b)=>a.localeCompare(b))
  const groups=unique(rows.map(r=>text(String(r[dimension]??'')))).sort((a,b)=>a.localeCompare(b))
  const values=useMemo(()=>{
    const m=new Map<string,{available:number;total:number}>()
    for(const r of rows){
      const key=`${text(String(r[dimension]??''))}|||${accountLabel(r)}`
      const old=m.get(key)||{available:0,total:0};old.available+=r.available_count;old.total+=r.observation_count;m.set(key,old)
    }
    return m
  },[rows,dimension])
  return <div className="report-card analysis-panel">
    <div className="analysis-panel-head"><div><div className="eyebrow">Cross-retailer view</div><h2>Availability matrix</h2><p>Click any cell to focus the explorer on that segment.</p></div><label className="compact-select">Rows<select value={dimension} onChange={e=>setDimension(e.target.value as MatrixDimension)}><option value="brand">Brand</option><option value="format">Format</option><option value="category">Category</option><option value="business_unit">Business Unit</option></select></label></div>
    <div className="matrix-scroll"><table className="analysis-matrix"><thead><tr><th>{DIM_LABELS[dimension]}</th>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>
      {groups.map(g=><tr key={g}><th>{g}</th>{columns.map(c=>{const v=values.get(`${g}|||${c}`);const score=v?pct(v.available,v.total):null;return <td key={c}><button disabled={score===null} className={score===null?'matrix-cell empty-cell':`matrix-cell ${tone(score)}`} onClick={()=>score!==null&&onFocus(dimension,g,c)}>{score===null?'—':<><b>{score.toFixed(0)}%</b><small>{v!.available}/{v!.total}</small></>}</button></td>})}</tr>)}
    </tbody></table></div>
  </div>
}

function RankingView({rows,dailyRows,onFocus}:{rows:OlaExplorerRow[];dailyRows:OlaExplorerDailyRow[];onFocus:(dim:RankDimension,label:string)=>void}){
  const [dimension,setDimension]=useState<RankDimension>('brand')
  const [mode,setMode]=useState<'bottom'|'top'|'all'>('bottom')
  const grouped=useMemo(()=>{
    const map=new Map<string,{available:number;total:number}>()
    for(const r of rows){const key=text(String(r[dimension]??''));const x=map.get(key)||{available:0,total:0};x.available+=r.available_count;x.total+=r.observation_count;map.set(key,x)}
    let list=Array.from(map.entries()).map(([label,x])=>({label,...x,score:pct(x.available,x.total)}))
    list.sort((a,b)=>mode==='top'?b.score-a.score:a.score-b.score)
    if(mode!=='all')list=list.slice(0,10)
    return list
  },[rows,dimension,mode])
  const dates=unique(dailyRows.map(r=>r.snapshot_date)).sort()
  const sparkData=useMemo(()=>{
    const map=new Map<string,number[]>()
    for(const item of grouped){
      const vals=dates.map(d=>{
        const subset=dailyRows.filter(r=>r.snapshot_date===d&&text(String(r[dimension]??''))===item.label)
        return subset.length?sumRows(subset).score:Number.NaN
      }).filter(v=>Number.isFinite(v))
      map.set(item.label,vals)
    }
    return map
  },[dailyRows,dimension,dates,grouped])
  return <div className="report-card analysis-panel">
    <div className="analysis-panel-head"><div><div className="eyebrow">Best & weakest segments</div><h2>Performance ranking</h2><p>Use Bottom 10 to find the areas that need action first.</p></div><div className="ranking-controls"><label className="compact-select">Rank<select value={dimension} onChange={e=>setDimension(e.target.value as RankDimension)}>{Object.entries(DIM_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><div className="mini-tabs"><button className={mode==='bottom'?'active':''} onClick={()=>setMode('bottom')}>Bottom 10</button><button className={mode==='top'?'active':''} onClick={()=>setMode('top')}>Top 10</button><button className={mode==='all'?'active':''} onClick={()=>setMode('all')}>All</button></div></div></div>
    <div className="ranking-list">{grouped.map((g,i)=><button key={g.label} className="ranking-row" onClick={()=>onFocus(dimension,g.label)}><span className="rank-number">{i+1}</span><span className="rank-label"><b>{g.label}</b><small>{g.available.toLocaleString()} / {g.total.toLocaleString()} available</small></span><span className="rank-bar"><i style={{width:`${Math.max(2,g.score)}%`}}/></span><span className={`rank-score ${tone(g.score)}`}>{g.score.toFixed(1)}%</span><span className="rank-spark"><Sparkline values={sparkData.get(g.label)||[]}/></span><ChevronRight size={16}/></button>)}</div>
  </div>
}

function TrendView({dailyRows}:{dailyRows:OlaExplorerDailyRow[]}){
  const [dimension,setDimension]=useState<TrendDimension>('overall')
  const dates=unique(dailyRows.map(r=>r.snapshot_date)).sort()
  const series=useMemo(()=>{
    if(dimension==='overall')return ['Overall']
    const totals=new Map<string,number>()
    for(const r of dailyRows){const key=dimension==='account_name'?accountLabel(r):text(String(r[dimension]??''));totals.set(key,(totals.get(key)||0)+r.observation_count)}
    return Array.from(totals.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k])=>k)
  },[dailyRows,dimension])
  const chart=useMemo(()=>dates.map(d=>{
    const rec:any={date:shortDate(d)}
    const dayRows=dailyRows.filter(r=>r.snapshot_date===d)
    if(dimension==='overall')rec.Overall=Number(sumRows(dayRows).score.toFixed(1))
    else for(const s of series){const subset=dayRows.filter(r=>(dimension==='account_name'?accountLabel(r):text(String(r[dimension]??'')))===s);if(subset.length)rec[s]=Number(sumRows(subset).score.toFixed(1))}
    return rec
  }),[dailyRows,dates,dimension,series])
  return <div className="report-card analysis-panel">
    <div className="analysis-panel-head"><div><div className="eyebrow">Movement over time</div><h2>OLA trend</h2><p>See whether a weak result is persistent or a new drop.</p></div><label className="compact-select">Compare<select value={dimension} onChange={e=>setDimension(e.target.value as TrendDimension)}><option value="overall">Overall</option><option value="account_name">Account</option><option value="brand">Brand</option><option value="format">Format</option><option value="category">Category</option></select></label></div>
    {dates.length<2?<div className="analysis-empty">Trend comparison will become useful after at least two reporting dates are stored. The current point is already saved.</div>:<div className="trend-chart"><ResponsiveContainer width="100%" height={360}><LineChart data={chart} margin={{top:12,right:18,left:-10,bottom:4}}><CartesianGrid stroke="rgba(147,164,195,.13)" vertical={false}/><XAxis dataKey="date" stroke="#93a4c3" tick={{fontSize:11}}/><YAxis domain={[0,100]} stroke="#93a4c3" tick={{fontSize:11}} tickFormatter={v=>`${v}%`}/><Tooltip contentStyle={{background:'#10192b',border:'1px solid #26334f',borderRadius:10}} formatter={(v:any)=>[`${Number(v).toFixed(1)}%`,'OLA']}/><Legend wrapperStyle={{fontSize:11}}/>{series.map((s,i)=><Line key={s} type="monotone" dataKey={s} stroke={COLORS[i%COLORS.length]} strokeWidth={2.4} dot={{r:3}} activeDot={{r:5}} connectNulls/>)}</LineChart></ResponsiveContainer></div>}
  </div>
}

type DrillLevel='business_unit'|'category'|'format'|'brand'|'basepack'
const DRILL_LEVELS:DrillLevel[]=['business_unit','category','format','brand','basepack']
const DRILL_LABELS:Record<DrillLevel,string>={business_unit:'Business Unit',category:'Category',format:'Format',brand:'Brand',basepack:'Basepack'}
function DrillView({rows,dailyRows}:{rows:OlaExplorerRow[];dailyRows:OlaExplorerDailyRow[]}){
  const [path,setPath]=useState<Array<{level:DrillLevel;label:string}>>([])
  const narrowed=useMemo(()=>rows.filter(r=>path.every(p=>text(String(r[p.level]??''))===p.label)),[rows,path])
  const nextLevel=DRILL_LEVELS[path.length]
  const groups=useMemo(()=>{
    if(!nextLevel)return []
    const map=new Map<string,{available:number;total:number}>()
    for(const r of narrowed){const key=text(String(r[nextLevel]??''));const x=map.get(key)||{available:0,total:0};x.available+=r.available_count;x.total+=r.observation_count;map.set(key,x)}
    return Array.from(map.entries()).map(([label,x])=>({label,...x,score:pct(x.available,x.total)})).sort((a,b)=>a.label.localeCompare(b.label))
  },[narrowed,nextLevel])
  const finalBasepack=path.find(p=>p.level==='basepack')?.label
  const accountRows=useMemo(()=>{
    if(!finalBasepack)return []
    const map=new Map<string,{available:number;total:number}>()
    for(const r of narrowed){const key=accountLabel(r);const x=map.get(key)||{available:0,total:0};x.available+=r.available_count;x.total+=r.observation_count;map.set(key,x)}
    return Array.from(map.entries()).map(([label,x])=>({label,...x,score:pct(x.available,x.total)})).sort((a,b)=>a.label.localeCompare(b.label))
  },[narrowed,finalBasepack])
  function goto(index:number){setPath(p=>p.slice(0,index))}
  return <div className="report-card analysis-panel drill-panel">
    <div className="analysis-panel-head"><div><div className="eyebrow">Guided drill-down</div><h2>Explore the hierarchy</h2><p>No expand-all tree. Move one level at a time and keep your place with breadcrumbs.</p></div>{path.length?<button className="secondary-btn" onClick={()=>setPath([])}><RotateCcw size={14}/> Start over</button>:null}</div>
    <div className="drill-breadcrumb"><button onClick={()=>goto(0)}>All</button>{path.map((p,i)=><span key={`${p.level}-${p.label}`}><ChevronRight size={13}/><button onClick={()=>goto(i+1)}>{p.label}</button></span>)}</div>
    {!finalBasepack&&nextLevel?<><div className="drill-level-title"><span>{DRILL_LABELS[nextLevel]}</span><small>{groups.length} options</small></div><div className="drill-grid">{groups.map(g=><button key={g.label} className="drill-card" onClick={()=>setPath(p=>[...p,{level:nextLevel,label:g.label}])}><div><b>{g.label}</b><small>{g.available.toLocaleString()} / {g.total.toLocaleString()} available</small></div><div className={`drill-score ${tone(g.score)}`}>{g.score.toFixed(1)}%</div><ChevronRight size={17}/></button>)}</div></>:null}
    {finalBasepack?<div className="basepack-detail"><div className="basepack-detail-title"><div><small>Basepack</small><h3>{finalBasepack}</h3></div><div className={`drill-score ${tone(sumRows(narrowed).score)}`}>{sumRows(narrowed).score.toFixed(1)}%</div></div><div className="table-wrap"><table className="report-table"><thead><tr><th>Account / Branch</th><th className="num">Available</th><th className="num">Tracked</th><th className="num">OLA</th></tr></thead><tbody>{accountRows.map(r=><tr key={r.label}><td>{r.label}</td><td className="num">{r.available}</td><td className="num">{r.total}</td><td className="num"><span className={`score-pill ${r.score>=85?'high':r.score>=70?'mid':'low'}`}>{r.score.toFixed(0)}%</span></td></tr>)}</tbody></table></div></div>:null}
  </div>
}

function ChangePanel({dailyRows,onFocus}:{dailyRows:OlaExplorerDailyRow[];onFocus:(brand:string,account:string)=>void}){
  const dates=unique(dailyRows.map(r=>r.snapshot_date)).sort();const latest=dates.at(-1),previous=dates.at(-2)
  const changes=useMemo(()=>{
    if(!latest||!previous)return []
    const build=(date:string)=>{const map=new Map<string,{brand:string;account:string;available:number;total:number}>();for(const r of dailyRows.filter(x=>x.snapshot_date===date)){const brand=text(r.brand),account=accountLabel(r),key=`${brand}|||${account}`,old=map.get(key)||{brand,account,available:0,total:0};old.available+=r.available_count;old.total+=r.observation_count;map.set(key,old)}return map}
    const now=build(latest),prev=build(previous),out:any[]=[]
    for(const [key,n] of now){const p=prev.get(key);if(!p||!n.total||!p.total)continue;out.push({...n,delta:pct(n.available,n.total)-pct(p.available,p.total),score:pct(n.available,n.total)})}
    return out.sort((a,b)=>a.delta-b.delta)
  },[dailyRows,latest,previous])
  if(!latest||!previous)return <div className="change-panel report-card"><div className="analysis-panel-head"><div><div className="eyebrow">Automatic signal</div><h2>What changed?</h2></div></div><div className="analysis-empty">Drops and gains will appear after the second reporting day.</div></div>
  const drops=changes.filter(x=>x.delta<0).slice(0,5),gains=[...changes].sort((a,b)=>b.delta-a.delta).filter(x=>x.delta>0).slice(0,5)
  const list=(items:any[],kind:'drop'|'gain')=><div className="change-list">{items.length?items.map(x=><button key={`${x.brand}-${x.account}`} onClick={()=>onFocus(x.brand,x.account)}><span className={`change-icon ${kind}`}>{kind==='drop'?<ArrowDownRight size={15}/>:<ArrowUpRight size={15}/>}</span><span className="change-copy"><b>{x.brand}</b><small>{x.account}</small></span><span className={kind==='drop'?'red':'green'}>{x.delta>0?'+':''}{x.delta.toFixed(1)}pp</span></button>):<div className="analysis-empty compact">No {kind==='drop'?'drops':'gains'} in this period.</div>}</div>
  return <div className="change-panel report-card"><div className="analysis-panel-head"><div><div className="eyebrow">Automatic signal</div><h2>What changed?</h2><p>{shortDate(previous)} → {shortDate(latest)}</p></div></div><div className="change-columns"><div><h3>Biggest drops</h3>{list(drops,'drop')}</div><div><h3>Biggest gains</h3>{list(gains,'gain')}</div></div></div>
}

export default function OlaExplorer({rows,dailyRows}:{rows:OlaExplorerRow[];dailyRows:OlaExplorerDailyRow[]}){
  const [filters,setFilters]=useState<FilterState>(EMPTY)
  const [view,setView]=useState<ExplorerView>('matrix')
  const filtered=useMemo(()=>applyFilters(rows,filters),[rows,filters])
  const filteredDaily=useMemo(()=>applyFilters(dailyRows,filters),[dailyRows,filters])
  function update(k:FilterKey,v:string[]){setFilters(f=>({...f,[k]:v}))}
  function clear(){setFilters(EMPTY)}
  function focusDimension(dim:RankDimension,label:string){
    if(dim==='basepack'){setView('drill');return}
    update(dim as FilterKey,[label]);setView('drill')
  }
  function focusMatrix(dim:MatrixDimension,label:string,column:string){
    const next={...filters,[dim]:[label]} as FilterState
    if(column.includes(' · ')){const [account,branch]=column.split(' · ');next.account_name=[account==='dMart'?'dMart / Daraz':account];next.location_name=[branch]}
    else next.account_name=[column==='dMart'?'dMart / Daraz':column]
    setFilters(next);setView('drill')
  }
  function focusChange(brand:string,account:string){
    const next={...filters,brand:[brand]} as FilterState
    if(account.includes(' · ')){const [a,b]=account.split(' · ');next.account_name=[a==='dMart'?'dMart / Daraz':a];next.location_name=[b]}
    else next.account_name=[account==='dMart'?'dMart / Daraz':account]
    setFilters(next);setView('trend')
  }
  const views=[
    {key:'matrix' as ExplorerView,label:'Matrix',icon:<LayoutGrid size={15}/>},
    {key:'ranking' as ExplorerView,label:'Ranking',icon:<BarChart3 size={15}/>},
    {key:'trend' as ExplorerView,label:'Trend',icon:<LineChartIcon size={15}/>},
    {key:'drill' as ExplorerView,label:'Drill',icon:<Route size={15}/>}
  ]
  return <div className="explorer-layout modern-explorer">
    <FilterBar rows={rows} filters={filters} onChange={update} onClear={clear}/>
    <KpiStrip rows={filtered} dailyRows={filteredDaily}/>
    <div className="analysis-view-tabs">{views.map(v=><button key={v.key} className={view===v.key?'active':''} onClick={()=>setView(v.key)}>{v.icon}{v.label}</button>)}</div>
    {!filtered.length?<div className="report-card analysis-empty">No data matches the current filters.</div>:<>
      {view==='matrix'?<MatrixView rows={filtered} onFocus={focusMatrix}/>:null}
      {view==='ranking'?<RankingView rows={filtered} dailyRows={filteredDaily} onFocus={focusDimension}/>:null}
      {view==='trend'?<TrendView dailyRows={filteredDaily}/>:null}
      {view==='drill'?<DrillView rows={filtered} dailyRows={filteredDaily}/>:null}
      <ChangePanel dailyRows={filteredDaily} onFocus={focusChange}/>
    </>}
  </div>
}
