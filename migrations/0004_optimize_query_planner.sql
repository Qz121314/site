-- Refresh SQLite planner statistics after the complete production index set is installed.
-- Cloudflare recommends PRAGMA optimize after creating indexes so D1 can choose efficient plans.
PRAGMA optimize;
