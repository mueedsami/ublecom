
import {demoMode,supabase} from './supabase'

export async function searchStockProducts(q:string){
 if(demoMode||!supabase) return [
  {id:'demo1',basepack:'DOVE SHAMPOO INTENSIVE REPAIR 340ML',brand:'DOVE'},
  {id:'demo2',basepack:'LUX SHOWR BW BRIGHTENING VITAMIN C 245ML',brand:'LUX'}
 ].filter(x=>x.basepack.toLowerCase().includes(q.toLowerCase()))

 const {data,error}=await supabase
   .from('basepacks')
   .select('id,name,brand')
   .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
   .limit(20)

 if(error) console.error(error)
 return (data||[]).map((x:any)=>({id:x.id,basepack:x.name,brand:x.brand}))
}

export async function getStockHistory(basepackId:string, fallbackName?:string){
 if(demoMode||!supabase) return {
  product:fallbackName,
  days:['18 Sep','19 Sep','20 Sep','21 Sep','22 Sep'],
  rows:[
   {account:'Arogga',avg:100,status:[1,1,1,1,1]},
   {account:'Shajgoj',avg:80,status:[1,0,1,1,0]},
   {account:'Othoba',avg:60,status:[0,0,1,1,1]},
   {account:'Pandamart Gulshan',avg:75,status:[1,1,0,1,1]}
  ]
 }

 const {data,error}=await supabase
   .from('availability_snapshots')
   .select(`
      snapshot_date,
      available,
      accounts(name),
      locations(name)
   `)
   .eq('basepack_id',basepackId)
   .order('snapshot_date',{ascending:true})

 if(error){
   console.error(error)
   return {product:fallbackName,days:[],rows:[]}
 }

 const map:any={}
 const days:string[]=[]

for(const row of (data || [])){
   const d=row.snapshot_date
   if(!days.includes(d)) days.push(d)

   const account=row.accounts?.name || 'Unknown'
   const location=row.locations?.name
   const key=location && location.toLowerCase().includes('pandamart')
       ? `${account} - ${location}`
       : account

   if(!map[key]) map[key]={account:key,status:[]}
 }

 for(const key of Object.keys(map)){
   map[key].status=days.map(d=>{
     const found=(data||[]).find((r:any)=>{
       const acc=r.accounts?.name || 'Unknown'
       const loc=r.locations?.name
       const k=loc && loc.toLowerCase().includes('pandamart')
        ? `${acc} - ${loc}`
        : acc
       return k===key && r.snapshot_date===d
     })
     return found?.available ? 1:0
   })
   const vals=map[key].status
   map[key].avg=Math.round(vals.reduce((a:number,b:number)=>a+b,0)/vals.length*100)
 }

 return {
   product:fallbackName,
   days,
   rows:Object.values(map)
 }
}
