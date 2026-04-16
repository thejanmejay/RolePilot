"""SQLite schema definitions and database initialization."""

from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_id     TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    company         TEXT NOT NULL,
    location        TEXT DEFAULT '',
    url             TEXT DEFAULT '',
    easy_apply      INTEGER DEFAULT 0,
    remote          TEXT DEFAULT '',
    posted_date     TEXT DEFAULT '',
    salary          TEXT DEFAULT '',
    description     TEXT DEFAULT '',
    discovered_at   TEXT DEFAULT (datetime('now')),
    search_keywords TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS applications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id          INTEGER NOT NULL REFERENCES jobs(id),
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending, submitted, failed, skipped
    error_message   TEXT DEFAULT '',
    applied_at      TEXT DEFAULT (datetime('now')),
    dry_run         INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    action          TEXT NOT NULL,  -- search, apply, login, error
    detail          TEXT DEFAULT '',
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_stats (
    date            TEXT PRIMARY KEY,
    applications    INTEGER DEFAULT 0,
    searches        INTEGER DEFAULT 0,
    errors          INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_jobs_linkedin_id ON jobs(linkedin_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
"""


def get_db_path(db_file: str = "data/hunter.db") -> Path:
    path = Path(db_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def init_db(db_file: str = "data/hunter.db") -> sqlite3.Connection:
    """Create or open the database and ensure schema exists."""
    path = get_db_path(db_file)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
