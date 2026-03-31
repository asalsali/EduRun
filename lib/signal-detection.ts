import * as fs from 'fs'
import * as path from 'path'
import OpenAI from 'openai'
import type { SignalType } from './database.types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Read and extract the system prompt from prompts/signal-detection.md once at module load.
// The file wraps the prompt in the first ``` block under "## System Prompt".
const _rawPromptFile = fs.readFileSync(
  path.join(process.cwd(), 'prompts', 'signal-detection.md'),
  'utf-8',
)
const _match = _rawPromptFile.match(/```\n([\s\S]*?)\n```/)
const SYSTEM_PROMPT = _match ? _match[1] : _rawPromptFile

// ── Public types ──────────────────────────────────────────────────────────────

export interface DetectedSignal {
  signal_type: SignalType
  label: string
  reasoning: string
  confidence: number
}

export interface MessageSummary {
  role: 'student' | 'tutor'
  content: string
}

export interface SessionCtx {
  deadline_proximity?: string
  assignment?: string
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_SIGNAL_TYPES = new Set<string>([
  'answer_seeking',
  'urgency_framing',
  'topic_drift',
  'bypass_attempt',
])

function isDetectedSignal(s: unknown): s is DetectedSignal {
  if (typeof s !== 'object' || s === null) return false
  const sig = s as Record<string, unknown>
  return (
    typeof sig.signal_type === 'string' &&
    VALID_SIGNAL_TYPES.has(sig.signal_type) &&
    typeof sig.label === 'string' &&
    typeof sig.reasoning === 'string' &&
    typeof sig.confidence === 'number' &&
    sig.confidence >= 0 &&
    sig.confidence <= 1
  )
}

// ── detectSignals ─────────────────────────────────────────────────────────────
// Never throws. Returns [] on any error so callers can treat it as fire-and-forget.

export async function detectSignals(
  studentMessage: string,
  contextWindow: MessageSummary[],
  sessionContext: SessionCtx,
): Promise<DetectedSignal[]> {
  try {
    const userContent = JSON.stringify({
      student_message: studentMessage,
      context_window: contextWindow,
      session_context: sessionContext,
    })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { signals?: unknown[] }

    if (!Array.isArray(parsed.signals)) return []

    return parsed.signals.filter(isDetectedSignal)
  } catch (err) {
    console.error('[signal-detection] error:', err)
    return []
  }
}
