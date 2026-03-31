'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Json, SignalType } from '@/lib/database.types'

// ── Types ─────────────────────────────────────────────────────────────────────

type RawSignal = { signal_type: string }
type RawMessage = { id: string }

type SessionRow = {
  id: string
  started_at: string
  ended_at: string | null
  context: Json
  messages: RawMessage[]
  signals: RawSignal[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const DISPLAY_TIMEZONE = 'America/Toronto'

const ORDERED_SIGNAL_TYPES: SignalType[] = [
  'answer_seeking',
  'urgency_framing',
  'topic_drift',
  'bypass_attempt',
]

const SIGNAL_LABELS: Record<string, string> = {
  answer_seeking: 'Answer Seeking',
  urgency_framing: 'Urgency Framing',
  topic_drift: 'Topic Drift',
  bypass_attempt: 'Bypass Attempt',
}

const SIGNAL_BADGE: Record<string, string> = {
  answer_seeking: 'bg-amber-100 text-amber-700',
  urgency_framing: 'bg-red-100 text-red-700',
  topic_drift: 'bg-purple-100 text-purple-700',
  bypass_attempt: 'bg-rose-100 text-rose-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
  })
}

function formatAssignment(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getStudentName(context: Json): string {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    const name = (context as Record<string, unknown>).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return 'Anonymous'
}

function getAssignment(context: Json): string | null {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    const a = (context as Record<string, unknown>).assignment
    if (typeof a === 'string') return a
  }
  return null
}

// Red if any bypass_attempt or 3+ answer_seeking; amber if any urgency_framing; green otherwise.
function getRisk(signals: RawSignal[]): 'red' | 'amber' | 'green' {
  const bypasses = signals.filter((s) => s.signal_type === 'bypass_attempt').length
  const answerSeeking = signals.filter((s) => s.signal_type === 'answer_seeking').length
  const urgency = signals.filter((s) => s.signal_type === 'urgency_framing').length
  if (bypasses > 0 || answerSeeking >= 3) return 'red'
  if (urgency > 0) return 'amber'
  return 'green'
}

const RISK_STYLES = {
  red: { dot: 'bg-red-500', label: 'text-red-600', text: 'High' },
  amber: { dot: 'bg-amber-500', label: 'text-amber-600', text: 'Medium' },
  green: { dot: 'bg-emerald-500', label: 'text-emerald-600', text: 'Normal' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InstructorDashboard() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sessions')
      .select('id, started_at, ended_at, context, messages(id), signals(signal_type)')
      .order('started_at', { ascending: false })

    if (data) {
      const typed = data as unknown as SessionRow[]
      // Live sessions first, then by started_at descending
      typed.sort((a, b) => {
        if (a.ended_at === null && b.ended_at !== null) return -1
        if (a.ended_at !== null && b.ended_at === null) return 1
        return new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      })
      setSessions(typed)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [load])

  const totalSessions = sessions.length
  const activeSessions = sessions.filter((s) => s.ended_at === null).length

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-baseline justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Instructor Dashboard</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {totalSessions} session{totalSessions !== 1 ? 's' : ''}
              {activeSessions > 0 && (
                <>
                  {' · '}
                  <span className="text-emerald-600 font-medium">{activeSessions} live</span>
                </>
              )}
            </p>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Home
          </Link>
        </div>
      </header>

      {/* ── Session list ── */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-16">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No sessions yet.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isLive = session.ended_at === null
              const risk = getRisk(session.signals)
              const riskStyle = RISK_STYLES[risk]
              const assignment = getAssignment(session.context)
              const signalBreakdown = ORDERED_SIGNAL_TYPES.map((type) => ({
                type,
                count: session.signals.filter((s) => s.signal_type === type).length,
              })).filter((s) => s.count > 0)

              return (
                <div
                  key={session.id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">

                      {/* Name + live badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {getStudentName(session.context)}
                        </span>
                        {isLive && (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        )}
                      </div>

                      {/* Time + assignment */}
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-400 mb-3">
                        <span>{formatDateTime(session.started_at)}</span>
                        {assignment && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span>{formatAssignment(assignment)}</span>
                          </>
                        )}
                      </div>

                      {/* Counts + risk */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          {session.messages.length} msg{session.messages.length !== 1 ? 's' : ''}
                        </span>
                        <span>
                          {session.signals.length} signal{session.signals.length !== 1 ? 's' : ''}
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${riskStyle.label}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${riskStyle.dot}`} />
                          {riskStyle.text} risk
                        </span>
                      </div>

                      {/* Signal type breakdown */}
                      {signalBreakdown.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {signalBreakdown.map(({ type, count }) => (
                            <span
                              key={type}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIGNAL_BADGE[type] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {SIGNAL_LABELS[type] ?? type} ×{count}
                            </span>
                          ))}
                        </div>
                      )}

                    </div>

                    {/* View replay */}
                    <Link
                      href={`/instructor/sessions/${session.id}`}
                      className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors whitespace-nowrap"
                    >
                      View Replay
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </main>
  )
}
