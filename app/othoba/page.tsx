import MarketplaceAccountPage from '../marketplace/[account]/page'

export const dynamic = 'force-dynamic'

export default function OthobaPage() {
  return <MarketplaceAccountPage params={{ account: 'othoba' }} />
}
