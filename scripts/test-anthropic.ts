import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'

// ── 1. Read and parse .env.local manually ─────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env.local')
const raw = fs.readFileSync(envPath, 'utf-8')

function parseEnvFile(src: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of src.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    const val = trimmed.slice(idx + 1)
    result[key] = val
  }
  return result
}

const env = parseEnvFile(raw)

// ── 2. Extract key and measure before/after trim ──────────────────────────────
const rawKey: string = env['ANTHROPIC_API_KEY'] ?? ''
const cleanKey: string = rawKey.trim().replace(/[\r\n]/g, '')

console.log('[key-debug] raw key length   :', rawKey.length)
console.log('[key-debug] clean key length :', cleanKey.length)

if (!cleanKey) {
  console.error('[error] ANTHROPIC_API_KEY not found in .env.local')
  process.exit(1)
}

// ── 3. Make minimal Anthropic API call ────────────────────────────────────────
const client = new Anthropic({ apiKey: cleanKey })

;(async () => {
  try {
    console.log('[test] sending request to Anthropic...')
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'say hello' }],
    })
    console.log('[test] SUCCESS — full response:')
    console.log(JSON.stringify(response, null, 2))
  } catch (err) {
    console.error('[test] ERROR — full error:')
    console.error(err)
  }
})()
