import { NextRequest, NextResponse } from 'next/server'
import { getDhFlags, updateDhFlagStatus, DhFlagStatus, DhFlagSeverity, DhFlagType } from '@/lib/dhFlags'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') as DhFlagStatus | 'all') || 'open'
    const severity = (searchParams.get('severity') as DhFlagSeverity | 'all') || 'all'
    const flagType = (searchParams.get('flag_type') as DhFlagType | 'all') || 'all'
    const search = searchParams.get('search') || undefined

    const result = await getDhFlags({
      status,
      severity,
      flagType,
      search,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('DH flags GET error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch DH flags' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status } = body

    if (!id || !status || !['open', 'acknowledged', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid id or status provided' }, { status: 400 })
    }

    await updateDhFlagStatus(id, status as DhFlagStatus)
    return NextResponse.json({ success: true, id, status })
  } catch (err: any) {
    console.error('DH flags PATCH error:', err)
    return NextResponse.json({ error: err.message || 'Failed to update flag status' }, { status: 500 })
  }
}
