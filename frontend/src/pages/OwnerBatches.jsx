import React, { useEffect, useState } from 'react'
import { BookOpen, Users, CalendarDays, Search } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { getOwnerBatches } from '../api/index.js'

export default function OwnerBatches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getOwnerBatches()
      .then(res => setBatches(res.data.batches || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (d) => {
    try { return d ? format(parseISO(d), 'MMM d, yyyy') : '—' } catch { return '—' }
  }

  const filtered = batches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.trainer_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Batches</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of all batches across every trainer</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search batches or trainers..."
            className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">{search ? 'No batches match your search' : 'No batches created yet'}</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Batch</span>
              <span>Trainer</span>
              <span>Dates</span>
              <span>Students</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.map(batch => (
                <div key={batch.id} className="flex flex-col sm:grid sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 sm:gap-4 items-start sm:items-center px-6 py-4 hover:bg-slate-50/60 transition">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{batch.name}</p>
                    {batch.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{batch.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-xs">{batch.trainer_name?.charAt(0)}</span>
                    </div>
                    <span className="text-sm text-brand-blue font-medium truncate">{batch.trainer_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays size={13} className="text-slate-400" />
                    {formatDate(batch.start_date)} — {formatDate(batch.end_date)}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Users size={14} className="text-slate-400" />
                    {batch.student_count}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
