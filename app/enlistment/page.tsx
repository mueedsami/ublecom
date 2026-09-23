'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import EnlistmentHub from '@/components/EnlistmentHub'
import Loading from '@/components/Loading'

function EnlistmentContent() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  const platform = searchParams.get('platform') || ''

  const isPartner = view === 'partner'

  return (
    <>
      <Header
        eyebrow="Digital Shelf Commercials & Cataloging"
        title="Product Enlistment Hub"
        subtitle={
          isPartner
            ? 'External Partner Portal — Inspect Unilever product specifications, copy barcodes, and download enlistment templates.'
            : 'Maintain products in the pipeline open for enlistment, configure trade pricing, and share verified dossiers with retail accounts.'
        }
      />
      <EnlistmentHub initialIsPartnerView={isPartner} initialPlatform={platform} />
    </>
  )
}

export default function EnlistmentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EnlistmentContent />
    </Suspense>
  )
}
