import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'
import { TUTOR_SYSTEM_PROMPT } from '@/lib/tutor-prompt'
import { parseSessionContext } from '@/lib/database.types'
import { detectSignals, type MessageSummary } from '@/lib/signal-detection'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  console.log('[key-debug] OPENAI_API_KEY length=%d supabase_url length=%d',
    process.env.OPENAI_API_KEY?.length ?? -1,
    process.env.NEXT_PUBLIC_SUPABASE_URL?.length ?? -1,
  )

  const { sessionId, content } = await req.json() as { sessionId: string; content: string }

  console.log('[chat] POST sessionId=%s content=%s', sessionId, content?.slice(0, 60))

  if (!sessionId || !content?.trim()) {
    return NextResponse.json({ error: 'sessionId and content are required' }, { status: 400 })
  }

  // ── 1. Determine next sequence_order ──────────────────────────────────────
  const { data: latest } = await supabase
    .from('messages')
    .select('sequence_order')
    .eq('session_id', sessionId)
    .order('sequence_order', { ascending: false })
    .limit(1)

  const nextOrder = (latest?.[0]?.sequence_order ?? 0) + 1
  console.log('[chat] step1 nextOrder=%d', nextOrder)

  // ── 2. Write student message ───────────────────────────────────────────────
  const { data: studentMsg, error: studentWriteError } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      role: 'student',
      content: content.trim(),
      sequence_order: nextOrder,
    })
    .select('id')
    .single()

  console.log('[chat] step2 studentWriteError=%o studentMsgId=%s', studentWriteError ?? null, studentMsg?.id ?? null)

  if (studentWriteError || !studentMsg) {
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // ── 3. Fetch full conversation history ────────────────────────────────────
  const { data: history, error: historyError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('sequence_order', { ascending: true })

  console.log('[chat] step3 historyError=%o historyLength=%d', historyError ?? null, history?.length ?? 0)

  if (historyError || !history) {
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 })
  }

  // ── 4. Call OpenAI ───────────────────────────────────────────────────────
  // Map DB roles to OpenAI roles. Messages must alternate user/assistant.
  const openaiMessages = history.map((m) => ({
    role: m.role === 'student' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  console.log('[chat] step4 calling OpenAI model=gpt-4o-mini messages=%d apiKeyPresent=%s',
    openaiMessages.length,
    !!process.env.OPENAI_API_KEY,
  )

  let tutorContent: string
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      messages: [
        { role: 'system', content: TUTOR_SYSTEM_PROMPT },
        ...openaiMessages,
      ],
    })
    console.log('[chat] step4 OpenAI ok finishReason=%s', response.choices[0]?.finish_reason)
    tutorContent = response.choices[0]?.message?.content ?? 'Could not generate response.'
  } catch (err) {
    console.error('[chat] step4 OpenAI error:', err)
    return NextResponse.json({ error: 'Tutor unavailable' }, { status: 502 })
  }

  // ── 5. Write tutor response ───────────────────────────────────────────────
  const { data: tutorMessage, error: tutorWriteError } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      role: 'tutor',
      content: tutorContent,
      sequence_order: nextOrder + 1,
    })
    .select('id, content, sequence_order')
    .single()

  console.log('[chat] step5 tutorWriteError=%o tutorMessageId=%s', tutorWriteError ?? null, tutorMessage?.id ?? null)

  if (tutorWriteError || !tutorMessage) {
    return NextResponse.json({ error: 'Failed to save tutor response' }, { status: 500 })
  }

  // ── 6. Signal detection (non-blocking) ───────────────────────────────────────
  // Fire-and-forget: never delays or fails the chat response.
  void runSignalDetection(sessionId, studentMsg.id, content.trim(), history)

  return NextResponse.json({ tutorMessage })
}

// ── runSignalDetection ────────────────────────────────────────────────────────
// Called with void — must never throw. Fetches session context, runs detection,
// and inserts any signals with confidence >= 0.70 into the signals table.

async function runSignalDetection(
  sessionId: string,
  studentMessageId: string,
  studentContent: string,
  history: Array<{ role: string; content: string }>,
): Promise<void> {
  try {
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('context')
      .eq('id', sessionId)
      .single()

    const sessionContext = parseSessionContext(sessionData?.context ?? null)

    // Last 5 messages before the current student message (history already includes it as the last entry)
    const contextWindow: MessageSummary[] = history
      .slice(0, -1)
      .slice(-5)
      .map((m) => ({ role: m.role as 'student' | 'tutor', content: m.content }))

    const signals = await detectSignals(studentContent, contextWindow, sessionContext)
    console.log('[chat] step6 detected=%d studentMsgId=%s', signals.length, studentMessageId)

    for (const signal of signals) {
      if (signal.confidence >= 0.70) {
        const { error } = await supabase.from('signals').insert({
          message_id: studentMessageId,
          session_id: sessionId,
          signal_type: signal.signal_type,
          label: signal.label,
          reasoning: signal.reasoning,
          confidence: signal.confidence,
        })
        if (error) console.error('[chat] step6 signal insert error:', error)
      }
    }
  } catch (err) {
    console.error('[chat] step6 runSignalDetection error:', err)
  }
}
