import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export interface EnlistmentAccountDto {
  id: string
  code: string
  name: string
  account_type: 'retailer' | 'marketplace' | 'quick_commerce'
  active: boolean
  created_at?: string
  updated_at?: string
}

const DEFAULT_ACCOUNTS: Omit<EnlistmentAccountDto, 'id'>[] = [
  { code: 'daraz', name: 'Daraz', account_type: 'marketplace', active: true },
  { code: 'chaldal', name: 'Chaldal', account_type: 'retailer', active: true },
  { code: 'shwapno', name: 'Shwapno', account_type: 'retailer', active: true },
  { code: 'pandamart', name: 'PandaMart', account_type: 'quick_commerce', active: true },
  { code: 'shajgoj', name: 'Shajgoj', account_type: 'retailer', active: true },
  { code: 'arogga', name: 'Arogga', account_type: 'retailer', active: true },
  { code: 'meenaclick', name: 'MeenaClick', account_type: 'retailer', active: true },
  { code: 'othoba', name: 'Othoba', account_type: 'retailer', active: true },
  { code: 'foodi', name: 'Foodi', account_type: 'quick_commerce', active: true },
]

export async function GET() {
  try {
    const admin = getAdminClient()
    const { data, error } = await admin
      .from('accounts')
      .select('id, code, name, account_type, active, created_at, updated_at')
      .order('name', { ascending: true })

    if (error) {
      console.error('Failed to query accounts from Supabase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If table is completely empty, optionally seed default accounts
    if (!data || data.length === 0) {
      const seeded: EnlistmentAccountDto[] = []
      for (const acc of DEFAULT_ACCOUNTS) {
        const { data: inserted } = await admin
          .from('accounts')
          .insert([acc])
          .select()
          .maybeSingle()
        if (inserted) seeded.push(inserted as EnlistmentAccountDto)
      }
      return NextResponse.json({ accounts: seeded })
    }

    return NextResponse.json({ accounts: data as EnlistmentAccountDto[] })
  } catch (err: any) {
    console.error('Accounts GET error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, account_type, code: customCode } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Account name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const baseCode = (customCode || trimmedName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || `acc_${Date.now()}`

    const admin = getAdminClient()

    // Ensure unique code
    let finalCode = baseCode
    const { data: existing } = await admin
      .from('accounts')
      .select('id, code')
      .eq('code', finalCode)
      .maybeSingle()

    if (existing) {
      finalCode = `${baseCode}_${Date.now().toString().slice(-4)}`
    }

    const validAccountType = ['retailer', 'marketplace', 'quick_commerce'].includes(account_type)
      ? account_type
      : 'retailer'

    const { data, error } = await admin
      .from('accounts')
      .insert([
        {
          name: trimmedName,
          code: finalCode,
          account_type: validAccountType,
          active: true,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Failed to create account in database:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ account: data })
  } catch (err: any) {
    console.error('Accounts POST error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to create account' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, active, name, account_type } = body

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof active === 'boolean') {
      updates.active = active
    }
    if (name && typeof name === 'string' && name.trim()) {
      updates.name = name.trim()
    }
    if (account_type && ['retailer', 'marketplace', 'quick_commerce'].includes(account_type)) {
      updates.account_type = account_type
    }

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update account:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ account: data })
  } catch (err: any) {
    console.error('Accounts PATCH error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to update account' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Try hard delete
    const { error: delError } = await admin.from('accounts').delete().eq('id', id)

    if (delError) {
      // If foreign key constraint blocks deletion, safely deactivate it instead
      console.warn('Hard delete blocked by foreign key, deactivating account instead:', delError)
      const { data: updated, error: updateError } = await admin
        .from('accounts')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: 'Account has linked data in other modules, so it was marked Inactive.',
        account: updated,
      })
    }

    return NextResponse.json({ success: true, deleted: true })
  } catch (err: any) {
    console.error('Accounts DELETE error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to delete account' },
      { status: 500 }
    )
  }
}
