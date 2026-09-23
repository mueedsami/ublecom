'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loading from '@/components/Loading'
import CheckerPanel from '@/components/CheckerPanel'
import { CheckerDataResult, getCheckerData, getCheckerDates } from '@/lib/checkerData'

export default function CheckerPage() {
  const [data, setData] = useState<CheckerDataResult | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData(date?: string) {
    setLoading(true)
    setError(null)
    try {
      const dates = await getCheckerDates()
      const target = date || selectedDate || dates[0] || '2026-09-23'
      setSelectedDate(target)
      const res = await getCheckerData(target)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load checker data:', err)
      setError(err?.message || 'Failed to load shelf availability checking data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleDateChange(newDate: string) {
    setSelectedDate(newDate)
    loadData(newDate)
  }

  return (
    <>
      <Header
        eyebrow="Digital Shelf Auditing"
        title="Shelf & Availability Checker"
        subtitle="Inspect available basepacks, account-wise in-stock products, and out-of-stock items in real time."
      />

      {error && (
        <div className="card error-card">
          <strong>Could not load shelf checking data.</strong>
          <div>{error}</div>
          <button className="secondary-btn" onClick={() => loadData()} style={{ marginTop: 10 }}>
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <Loading />
      ) : data ? (
        <CheckerPanel
          data={data}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          loading={loading}
        />
      ) : null}
    </>
  )
}
