import './globals.css'
import AppShell from '@/components/AppShell'
import AuthGate from '@/components/AuthGate'
export const metadata={title:'UBL Stock Intelligence system',description:'Unilever Bangladesh e-commerce stock intelligence dashboard'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AuthGate><AppShell>{children}</AppShell></AuthGate></body></html>}
