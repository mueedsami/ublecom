import { NextRequest, NextResponse } from 'next/server'
import { generateMarketplaceFlagsPass } from '@/lib/marketplaceFlags'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get('account') || 'othoba'

    const count = await generateMarketplaceFlagsPass(account)
    return NextResponse.json({ success: true, count, account })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to generate flags pass' },
      { status: 500 }
    )
  }
}
