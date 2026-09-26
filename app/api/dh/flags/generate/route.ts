import { NextRequest, NextResponse } from 'next/server'
import { generateDhFlagsPass } from '@/lib/dhFlags'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_req: NextRequest) {
  try {
    const summary = await generateDhFlagsPass()
    return NextResponse.json(summary)
  } catch (err: any) {
    console.error('DH flag generation error:', err)
    return NextResponse.json({ error: err.message || 'Flag generation failed' }, { status: 500 })
  }
}
