'use client'
import { useEffect,useState } from 'react'
import { demoMode, supabase } from '@/lib/supabase'
import LoginForm from './LoginForm'
export default function AuthGate({children}:{children:React.ReactNode}){const [ready,setReady]=useState(demoMode);const [ok,setOk]=useState(demoMode);useEffect(()=>{if(demoMode||!supabase)return;supabase.auth.getSession().then(({data})=>{setOk(Boolean(data.session));setReady(true)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setOk(Boolean(s));setReady(true)});return()=>data.subscription.unsubscribe()},[]);if(!ready)return <div className="login">Loading…</div>;if(!ok)return <LoginForm/>;return <>{children}</>}
