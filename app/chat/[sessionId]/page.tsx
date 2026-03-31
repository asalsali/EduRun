'use client'

import { use, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { parseSessionContext } from '@/lib/database.types'

type Message = {
  id: string
  role: 'student' | 'tutor'
  content: string
  optimistic?: boolean
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const [messages, setMessages] = useState<Message[]>([])
  const [studentName, setStudentName] = useState('Student')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load session and message history
  useEffect(() => {
    async function load() {
      const [{ data: session }, { data: history }] = await Promise.all([
        supabase.from('sessions').select('context').eq('id', sessionId).single(),
        supabase
          .from('messages')
          .select('id, role, content')
          .eq('session_id', sessionId)
          .order('sequence_order', { ascending: true }),
      ])

      if (session) {
        const ctx = parseSessionContext(session.context)
        if (ctx.name) setStudentName(ctx.name)
      }

      setMessages(
        (history ?? []).map((m) => ({
          id: m.id,
          role: m.role as 'student' | 'tutor',
          content: m.content,
        })),
      )
      setLoading(false)
    }
    load()
  }, [sessionId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const content = input.trim()
    if (!content || sending) return

    const optimisticId = crypto.randomUUID()

    // Optimistic update — student message appears immediately
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: 'student', content, optimistic: true },
    ])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)

      const { tutorMessage } = await res.json()

      setMessages((prev) => [
        // Replace optimistic placeholder with confirmed message
        ...prev.filter((m) => m.id !== optimisticId),
        { id: crypto.randomUUID(), role: 'student', content },
        { id: tutorMessage.id, role: 'tutor', content: tutorMessage.content },
      ])
    } catch {
      // Remove optimistic message on failure — let the user retry
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    )
  }

  return (
    <main className="flex flex-col h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-none">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-base font-semibold text-gray-900">{studentName}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Conrad BET · Pitch Deck</p>
        </div>
      </header>

      {/* ── Message thread ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {messages.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-gray-400">
                Start by telling me what you're working on.
              </p>
            </div>
          )}

          {messages.map((message) => {
            const isStudent = message.role === 'student'
            return (
              <div key={message.id} className={`flex ${isStudent ? 'justify-start' : 'justify-end'}`}>
                <p
                  className={[
                    'max-w-[75%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl',
                    isStudent
                      ? 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm',
                    message.optimistic ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  {message.content}
                </p>
              </div>
            )
          })}

          {/* Tutor thinking indicator */}
          {sending && (
            <div className="flex justify-end">
              <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-2.5">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 flex-none">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="flex-none rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>

    </main>
  )
}
