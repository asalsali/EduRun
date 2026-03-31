'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Hardcoded for pilot — one course, one section, one term.
const PILOT_COURSE_ID = '00000000-0000-0000-0000-000000000003'
const PILOT_CONTEXT = {
  assignment: 'pitch_deck',
  deadline_proximity: '10.5h before pitch deck due',
}

export default function ChatEntryPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('sessions')
      .insert({
        student_id: crypto.randomUUID(),
        course_id: PILOT_COURSE_ID,
        context: { name: trimmed, ...PILOT_CONTEXT },
      })
      .select('id')
      .single()

    console.log('[session] insertError=%o data=%o', insertError ?? null, data ?? null)

    if (insertError || !data) {
      setError('Could not start session. Check your connection and try again.')
      setLoading(false)
      return
    }

    console.log('[session] redirecting to /chat/%s', data.id)
    router.push(`/chat/${data.id}`)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 mb-3">
            <span className="text-white font-bold leading-none">E</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">EduRun</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Your AI tutor for BET courses — ask questions, work through ideas, get guidance
          </p>
        </div>

        {/* Name entry form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Your name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              required
              autoFocus
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Starting…' : 'Start session'}
          </button>
        </form>

        {/* What to expect */}
        <p className="mt-4 text-center text-xs text-gray-400">
          Your tutor uses Socratic method — expect questions back, not answers
        </p>

      </div>
    </main>
  )
}
