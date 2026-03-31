# EduRun

Passive assessment layer for AI tutor sessions. Analyzes student interactions to surface behavioral signals — answer-seeking, urgency framing, topic drift, bypass attempts — for instructors, without formal assessments.

**Pilot:** Conrad School of Entrepreneurship, UW. One BET course section, one instructor, 30 students, one term.

---

## Local Setup

### Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase` or see docs)
- A Supabase project — local or hosted

### Install dependencies

```bash
npm install
```

### Environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project URL and anon key. Find them in the Supabase dashboard under **Settings → API**.

---

### Option A: Local Supabase instance (recommended for development)

Start a local instance and apply everything in one command:

```bash
supabase start
supabase db reset
```

`db reset` drops and recreates the database, applies all migrations in `supabase/migrations/` in filename order, then runs `supabase/seed.sql`.

Get your local connection string:

```bash
supabase status
# look for DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

---

### Option B: Hosted Supabase project

Push the migration to your hosted project:

```bash
supabase db push
```

Then seed it:

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

`DATABASE_URL` is your project's connection string. Find it in the Supabase dashboard under **Settings → Database → Connection string → URI**.

---

### Run the dev server

```bash
npm run dev
```

Open the demo session:
```
http://localhost:3000/instructor/sessions/00000000-0000-0000-0000-000000000001
```

### Verify the seed loaded

Run these queries against your database to confirm:

```sql
-- 15 messages in the test session
SELECT count(*) FROM messages
WHERE session_id = '00000000-0000-0000-0000-000000000001';
-- expect: 15

-- 7 signals across messages 5, 9, 11, 13
SELECT
  messages.sequence_order,
  signals.signal_type,
  signals.confidence
FROM signals
JOIN messages ON signals.message_id = messages.id
WHERE signals.session_id = '00000000-0000-0000-0000-000000000001'
ORDER BY messages.sequence_order, signals.confidence DESC;
-- expect: 7 rows
-- msg 5:  answer_seeking 0.97, urgency_framing 0.91
-- msg 9:  answer_seeking 0.93, urgency_framing 0.88
-- msg 11: bypass_attempt 0.95, answer_seeking 0.82
-- msg 13: topic_drift 0.74
```

---

## Project structure

```
docs/
  signal-taxonomy.md        source of truth for signal definitions
  test-session-01.md        FreshCast pilot test session (raw)
prompts/
  signal-detection.md       Anthropic system prompt + user message template
supabase/
  migrations/
    20260330000000_initial_schema.sql
  seed.sql                  FreshCast test session with classified signals
```
