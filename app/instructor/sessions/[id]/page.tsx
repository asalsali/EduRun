'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseSessionContext, type MessageWithSignals, type SignalType, type Json } from '@/lib/database.types'

function getStudentName(context: Json): string {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    const name = (context as Record<string, unknown>).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return 'Student'
}

// ── Configuration ────────────────────────────────────────────────────────────
// Signals below this threshold are stored but not displayed.
// Change here and redeploy — no database change needed.
const SIGNAL_CONFIDENCE_THRESHOLD = 0.70

// Pilot is one institution — America/Toronto is correct for Conrad School, UW.
// Revisit when EduRun expands to multiple institutions.
const DISPLAY_TIMEZONE = 'America/Toronto'

// Demo session from supabase/seed.sql.
// Visit: /instructor/sessions/00000000-0000-0000-0000-000000000001
const DEMO_SESSION_ID = '00000000-0000-0000-0000-000000000001'

// ── Signal display config ─────────────────────────────────────────────────────
// Full class strings (not constructed dynamically) so Tailwind's purge picks them up.
// The '_unknown' fallback renders if a signal_type in the DB has no matching entry here.
const SIGNAL_STYLES: Record<string, { display: string; card: string; badge: string }> = {
  answer_seeking: {
    display: 'Answer Seeking',
    card: 'bg-amber-50 border-l-amber-400 text-amber-900',
    badge: 'bg-amber-100 text-amber-700',
  },
  urgency_framing: {
    display: 'Urgency Framing',
    card: 'bg-red-50 border-l-red-400 text-red-900',
    badge: 'bg-red-100 text-red-700',
  },
  topic_drift: {
    display: 'Topic Drift',
    card: 'bg-purple-50 border-l-purple-400 text-purple-900',
    badge: 'bg-purple-100 text-purple-700',
  },
  bypass_attempt: {
    display: 'Bypass Attempt',
    card: 'bg-rose-50 border-l-rose-400 text-rose-900',
    badge: 'bg-rose-100 text-rose-700',
  },
  _unknown: {
    display: 'Unknown Signal',
    card: 'bg-gray-50 border-l-gray-400 text-gray-900',
    badge: 'bg-gray-100 text-gray-700',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
  })
}

function formatAssignment(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getSignalStyle(signalType: SignalType | string) {
  return SIGNAL_STYLES[signalType] ?? SIGNAL_STYLES['_unknown']
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SessionMeta = {
  id: string
  started_at: string
  ended_at: string | null
  context: Json
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SessionReplayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [session, setSession] = useState<SessionMeta | null>(null)
  const [thread, setThread] = useState<MessageWithSignals[]>([])
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    const [{ data: sessionData }, { data: messagesData }] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, started_at, ended_at, context')
        .eq('id', id)
        .single(),
      supabase
        .from('messages')
        .select(
          'id, role, content, sequence_order, created_at, signals(signal_type, label, reasoning, confidence)',
        )
        .eq('session_id', id)
        .order('sequence_order', { ascending: true }),
    ])

    if (!sessionData) {
      setMissing(true)
      return
    }
    setSession(sessionData as SessionMeta)
    setThread((messagesData ?? []) as MessageWithSignals[])
  }, [id])

  useEffect(() => {
    load()
    const timer = setInterval(load, 10_000)
    return () => clearInterval(timer)
  }, [load])

  if (missing) notFound()
  if (!session) return null

  const ctx = parseSessionContext(session.context)
  const isLive = session.ended_at === null

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Session header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-baseline justify-between mb-2">
            <Link
              href="/instructor"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold text-gray-900">{getStudentName(session.context)}</h1>
            <span className="text-sm text-gray-400">{formatTime(session.started_at)}</span>
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {ctx.assignment && (
              <span className="text-gray-500">{formatAssignment(ctx.assignment)}</span>
            )}
            {ctx.assignment && ctx.deadline_proximity && (
              <span className="text-gray-300">·</span>
            )}
            {ctx.deadline_proximity && (
              <span className="font-medium text-orange-600">{ctx.deadline_proximity}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Message thread ── */}
      <div className="max-w-2xl mx-auto px-4 py-8">

        {thread.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">
            No messages found for this session.
          </p>
        ) : (
          <div className="space-y-5">
            {thread.map((message) => {
              const isStudent = message.role === 'student'
              const visibleSignals = (message.signals ?? []).filter(
                (s) => s.confidence >= SIGNAL_CONFIDENCE_THRESHOLD,
              )

              return (
                <div key={message.id}>

                  {/* Message bubble */}
                  <div className={`flex ${isStudent ? 'justify-start' : 'justify-end'}`}>
                    <p
                      className={[
                        'max-w-[75%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl',
                        isStudent
                          ? 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm'
                          : 'bg-blue-600 text-white rounded-tr-sm',
                      ].join(' ')}
                    >
                      {message.content}
                    </p>
                  </div>

                  {/* Signal annotation cards — inline, directly below flagged student messages */}
                  {isStudent && visibleSignals.length > 0 && (
                    <div className="mt-2 space-y-2 max-w-[75%]">
                      {visibleSignals.map((signal) => {
                        const styles = getSignalStyle(signal.signal_type)
                        return (
                          <div
                            key={signal.signal_type}
                            className={[
                              'rounded-lg border-l-4 px-3.5 py-2.5 text-xs',
                              styles.card,
                            ].join(' ')}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={[
                                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                                  styles.badge,
                                ].join(' ')}
                              >
                                {styles.display}
                              </span>
                              <span className="opacity-50">
                                {Math.round(signal.confidence * 100)}%
                              </span>
                            </div>
                            <p className="font-semibold mb-0.5">{signal.label}</p>
                            <p className="opacity-70 leading-relaxed">{signal.reasoning}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}

      </div>

    </main>
  )
}
