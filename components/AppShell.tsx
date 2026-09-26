'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PackageCheck,
  CheckSquare,
  FileSpreadsheet,
  TrendingDown,
  Search,
  Bell,
  Boxes,
  Database,
  Store,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'

const items = [
  ['/', 'Overview', LayoutDashboard],
  ['/availability', 'Availability', PackageCheck],
  ['/checker', 'Shelf Checker', CheckSquare],
  ['/enlistment', 'Enlistment Hub', FileSpreadsheet],
  ['/dh', 'Pandamart DH', Store],
  ['/stock', 'Stock Tracking', Boxes],
  ['/price', 'Price / CPP', TrendingDown],
  ['/search', 'Search / SoS', Search],
  ['/alerts', 'Alerts', Bell],
] as const

const masterItems = [['/master/basepacks', 'Basepacks', Database]] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Prevent background scrolling when mobile menu drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const currentItem =
    items.find(([href]) => href === pathname) ||
    masterItems.find(([href]) => href === pathname)
  const currentTitle = currentItem ? currentItem[1] : 'Command Center'

  return (
    <div className="shell">
      {/* Mobile Top App Bar */}
      <header className="mobile-header">
        <div className="mobile-header-left">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="brand" style={{ margin: 0, fontSize: 15 }}>
            <b>UBL</b> Stock Intel
          </div>
        </div>

        <div className="mobile-header-badge">
          <span className="live-dot" />
          <span>{currentTitle}</span>
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar navigation (Desktop Sticky & Mobile Slide-over Drawer) */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand">
            <b>UBL</b> Stock Intelligence
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav">
          {items.map(([href, label, Icon]) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={16} className="nav-icon" />
                <span className="nav-label">{label}</span>
                {isActive && <ChevronRight size={14} className="nav-active-arrow" />}
              </Link>
            )
          })}

          <div className="nav-section-title">Master Data</div>
          {masterItems.map(([href, label, Icon]) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={16} className="nav-icon" />
                <span className="nav-label">{label}</span>
                {isActive && <ChevronRight size={14} className="nav-active-arrow" />}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="main">{children}</main>
    </div>
  )
}
