import { NextRequest, NextResponse } from 'next/server'
import { generateDhFlagsPass } from '@/lib/dhFlags'
import { getAdminClient } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_req: NextRequest) {
  try {
    const admin = getAdminClient()
    const summary = await generateDhFlagsPass(admin)
    return NextResponse.json(summary)
  } catch (err: any) {
    console.error('DH flag generation error:', err)
    return NextResponse.json({ error: err.message || 'Flag generation failed' }, { status: 500 })
  }
}
