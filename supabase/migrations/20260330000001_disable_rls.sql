-- Disable RLS for pilot — no auth in v1, anon key needs direct read access.
-- Re-enable and add policies before any multi-instructor or production deployment.
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE signals  DISABLE ROW LEVEL SECURITY;
