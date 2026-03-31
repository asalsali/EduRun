# EduRun

Passive assessment layer for AI tutor sessions. Analyzes student interactions to surface behavioral signals — answer-seeking, urgency framing, topic drift, bypass attempts — for instructors, without formal assessments.

**Live demo:** https://edurun-blue.vercel.app

**Pilot:** Conrad School of Entrepreneurship, UW. One BET course section, one instructor, 30 students, one term.

---

## How it works

Students chat with a Socratic AI tutor (GPT-4o-mini). After each student message, a second model call runs in the background to classify behavioral signals. Instructors see annotated session replays with confidence scores — no grading, no surveys, no extra work for students.

Signal types:

| Signal | Trigger |
|--------|---------|
| Answer Seeking | Student requests deliverable content rather than engaging with the concept |
| Urgency Framing | Time pressure used to justify an out-of-scope request |
| Topic Drift | Pivot to a new topic before resolving the current one, following tutor pushback |
| Bypass Attempt | Attempt to reassign the tutor's role or remove its constraints |

---

## Stack

- **Next.js 15** (App Router) — frontend and API routes
- **OpenAI GPT-4o-mini** — tutor LLM and signal classifier
- **Supabase** — Postgres database (sessions, messages, signals)
- **Tailwind CSS** — UI
- **Vercel** — hosting

---

## Routes

| Route | Who | What |
|-------|-----|------|
| `/` | Everyone | Landing page — role selection |
| `/chat` | Student | Name entry, starts a session |
| `/chat/[sessionId]` | Student | Live tutor chat |
| `/instructor` | Instructor | Dashboard — all sessions with signal breakdown |
| `/instructor/sessions/[id]` | Instructor | Session replay with inline signal annotations |

---

## Local setup

### Prerequisites

- Node.js 18+
- A Supabase project (local or hosted)
- An OpenAI API key

### Install

```bash
npm install
```

### Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...
```

### Database setup

**Option A — Local Supabase:**

```bash
supabase start
supabase db reset   # applies migrations + seed in one step
```

**Option B — Hosted Supabase:**

```bash
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

The seed loads the FreshCast test session (15 messages, 7 pre-classified signals) so the instructor view has something to show immediately.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To view the seeded demo session directly:
```
http://localhost:3000/instructor/sessions/00000000-0000-0000-0000-000000000001
```

---

## Project structure

```
app/
  page.tsx                      Landing page
  chat/
    page.tsx                    Student name entry
    [sessionId]/page.tsx        Live chat
  instructor/
    page.tsx                    Instructor dashboard
    sessions/[id]/page.tsx      Session replay
  api/chat/route.ts             Tutor API + async signal detection

lib/
  supabase.ts                   Supabase client
  database.types.ts             TypeScript types for all tables
  signal-detection.ts           OpenAI signal classifier (never throws)
  tutor-prompt.ts               Socratic tutor system prompt

prompts/
  signal-detection.md           Signal classifier system prompt + taxonomy

docs/
  signal-taxonomy.md            Source of truth for signal definitions
  test-session-01.md            FreshCast pilot test session (annotated)

supabase/
  migrations/                   Schema (tables, indexes, RLS, grants)
  seed.sql                      FreshCast test session with classified signals
```

---

## Signal detection flow

1. Student sends a message → saved to `messages`
2. Tutor response generated → saved to `messages`
3. Response returned to client immediately
4. `void runSignalDetection(...)` fires asynchronously — never blocks the chat
5. Classifier reads the last 5 messages as context + session metadata
6. Signals with confidence ≥ 0.70 are inserted into `signals`
7. Instructor dashboard and session replay poll for updates every 10–30 seconds

Detection never affects the student experience. If it fails, it fails silently.
