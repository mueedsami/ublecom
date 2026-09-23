import './globals.css'
import AppShell from '@/components/AppShell'
import AuthGate from '@/components/AuthGate'
export const metadata={title:'UBL Digital Shelf Command Center',description:'Unilever Bangladesh e-commerce digital shelf dashboard'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AuthGate><AppShell>{children}</AppShell></AuthGate></body></html>}
