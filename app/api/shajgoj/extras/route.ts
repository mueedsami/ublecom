import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { dismissShajgojExtra, promoteExtraToCore } from '@/lib/shajgojOlaData'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, dismissed } = body
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Missing itemId' }, { status: 400 })
    }

    const ok = await dismissShajgojExtra(itemId, Boolean(dismissed))
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to update dismiss status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, itemId, dismissed: Boolean(dismissed) })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, basepackId } = body
    if (!itemId || !basepackId) {
      return NextResponse.json({ success: false, error: 'Missing itemId or basepackId' }, { status: 400 })
    }

    const ok = await promoteExtraToCore(itemId, basepackId)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to promote extra to core' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully mapped SKU to basepack and promoted to Core tier. It will count in OLA on next upload.',
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
