'use client'
import { useEffect, useState } from 'react'
import { getOverview } from './data'
export function useOverview(){const [data,setData]=useState<any>(null);const [error,setError]=useState('');useEffect(()=>{let alive=true;getOverview().then(d=>alive&&setData(d)).catch(e=>alive&&setError(e?.message||String(e)));return()=>{alive=false}},[]);return {data,error,loading:!data&&!error}}
