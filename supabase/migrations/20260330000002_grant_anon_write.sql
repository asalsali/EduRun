-- Grant anon role write access for pilot.
-- RLS is disabled (see 20260330000001_disable_rls.sql), so Postgres falls back
-- to table-level privileges. Supabase only grants SELECT to anon by default;
-- INSERT/UPDATE/DELETE must be explicit.
-- Revisit before any multi-instructor or production deployment.
GRANT INSERT, UPDATE, DELETE ON TABLE sessions TO anon;
GRANT INSERT, UPDATE, DELETE ON TABLE messages TO anon;
GRANT INSERT, UPDATE, DELETE ON TABLE signals  TO anon;
