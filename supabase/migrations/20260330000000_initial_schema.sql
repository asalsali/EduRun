-- EduRun initial schema
-- 2026-03-30
--
-- Tables: sessions, messages, signals
-- No competency_scores in v1 — scoring deferred until signal taxonomy is validated
-- student_id and course_id are untyped UUIDs in v1 (no students/courses tables yet)

-- ============================================================
-- sessions
-- ============================================================
CREATE TABLE sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL,
  course_id    UUID        NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  -- context carries pilot-specific metadata: deadline_proximity, assignment name
  -- e.g. {"deadline_proximity": "10.5h before pitch deck due", "assignment": "pitch_deck"}
  context      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- messages
-- ============================================================
CREATE TABLE messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role           TEXT        NOT NULL CHECK (role IN ('student', 'tutor')),
  content        TEXT        NOT NULL,
  -- sequence_order is 1-indexed, set by the ingestion layer, not derived from created_at
  sequence_order INTEGER     NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- enforce message ordering uniqueness within a session
  UNIQUE (session_id, sequence_order)
);

CREATE INDEX messages_session_id_idx    ON messages (session_id);
CREATE INDEX messages_session_order_idx ON messages (session_id, sequence_order);

-- ============================================================
-- signals
-- Multiple rows per message_id are intentional.
-- A single message can trigger co-occurring signals
-- (e.g. answer_seeking + urgency_framing on the same message).
-- UNIQUE on (message_id, signal_type) prevents duplicate detection
-- runs from inserting the same signal twice for the same message.
-- ============================================================
CREATE TABLE signals (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   UUID             NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  session_id   UUID             NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  signal_type  TEXT             NOT NULL CHECK (
                                  signal_type IN (
                                    'answer_seeking',
                                    'urgency_framing',
                                    'topic_drift',
                                    'bypass_attempt'
                                  )
                                ),
  label        TEXT             NOT NULL,
  reasoning    TEXT             NOT NULL,
  confidence   DOUBLE PRECISION NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  -- prevents duplicate signal of the same type on the same message
  -- (e.g. edge function retry safety)
  UNIQUE (message_id, signal_type)
);

CREATE INDEX signals_message_id_idx ON signals (message_id);
CREATE INDEX signals_session_id_idx ON signals (session_id);
