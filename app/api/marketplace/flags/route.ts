import { NextRequest, NextResponse } from 'next/server'
import { getMarketplaceFlags, updateMarketplaceFlagStatus } from '@/lib/marketplaceFlags'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get('account') || 'othoba'
    const status = (searchParams.get('status') as any) || 'all'
    const severity = (searchParams.get('severity') as any) || 'all'
    const type = (searchParams.get('type') as any) || 'all'

    const res = await getMarketplaceFlags(account, { status, severity, type })
    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch flags' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { flagId, status } = body

    if (!flagId || !status) {
      return NextResponse.json({ error: 'Missing flagId or status' }, { status: 400 })
    }

    await updateMarketplaceFlagStatus(flagId, status)
    return NextResponse.json({ success: true, flagId, status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update flag status' }, { status: 500 })
  }
}
