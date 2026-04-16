"""CRUD operations for the hunter database."""

from __future__ import annotations

import sqlite3
from datetime import date, datetime
from typing import Optional


class JobRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def upsert_job(
        self,
        linkedin_id: str,
        title: str,
        company: str,
        location: str = "",
        url: str = "",
        easy_apply: bool = False,
        remote: str = "",
        posted_date: str = "",
        salary: str = "",
        description: str = "",
        search_keywords: str = "",
    ) -> int:
        """Insert or update a job. Returns the job row id."""
        cur = self.conn.execute(
            """INSERT INTO jobs (linkedin_id, title, company, location, url,
                                easy_apply, remote, posted_date, salary, description, search_keywords)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(linkedin_id) DO UPDATE SET
                   title=excluded.title,
                   company=excluded.company,
                   location=excluded.location,
                   url=excluded.url,
                   easy_apply=excluded.easy_apply,
                   remote=excluded.remote,
                   posted_date=excluded.posted_date,
                   salary=excluded.salary,
                   description=excluded.description
            """,
            (linkedin_id, title, company, location, url,
             int(easy_apply), remote, posted_date, salary, description, search_keywords),
        )
        self.conn.commit()
        # Fetch the id
        row = self.conn.execute(
            "SELECT id FROM jobs WHERE linkedin_id = ?", (linkedin_id,)
        ).fetchone()
        return row["id"]

    def get_job_by_linkedin_id(self, linkedin_id: str) -> Optional[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM jobs WHERE linkedin_id = ?", (linkedin_id,)
        ).fetchone()

    def get_easy_apply_jobs(self, keywords: str = "", limit: int = 50) -> list[sqlite3.Row]:
        """Get Easy Apply jobs that haven't been applied to yet."""
        query = """
            SELECT j.* FROM jobs j
            LEFT JOIN applications a ON a.job_id = j.id AND a.status IN ('submitted', 'skipped')
            WHERE j.easy_apply = 1 AND a.id IS NULL
        """
        params: list = []
        if keywords:
            query += " AND j.search_keywords = ?"
            params.append(keywords)
        query += " ORDER BY j.discovered_at DESC LIMIT ?"
        params.append(limit)
        return self.conn.execute(query, params).fetchall()

    def list_jobs(self, limit: int = 50, offset: int = 0) -> list[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM jobs ORDER BY discovered_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()


class ApplicationRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def record_application(
        self,
        job_id: int,
        status: str = "submitted",
        error_message: str = "",
        dry_run: bool = False,
    ) -> int:
        cur = self.conn.execute(
            "INSERT INTO applications (job_id, status, error_message, dry_run) VALUES (?, ?, ?, ?)",
            (job_id, status, error_message, int(dry_run)),
        )
        self.conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def was_applied(self, job_id: int) -> bool:
        row = self.conn.execute(
            "SELECT 1 FROM applications WHERE job_id = ? AND status = 'submitted'",
            (job_id,),
        ).fetchone()
        return row is not None

    def get_applications(self, days: int = 7, limit: int = 100) -> list[sqlite3.Row]:
        return self.conn.execute(
            """SELECT a.*, j.title, j.company, j.url
               FROM applications a
               JOIN jobs j ON j.id = a.job_id
               WHERE a.applied_at >= datetime('now', ?)
               ORDER BY a.applied_at DESC LIMIT ?""",
            (f"-{days} days", limit),
        ).fetchall()

    def count_today(self) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) as cnt FROM applications WHERE date(applied_at) = date('now') AND status = 'submitted'"
        ).fetchone()
        return row["cnt"]


class ActivityRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def log(self, action: str, detail: str = "") -> None:
        self.conn.execute(
            "INSERT INTO activity_log (action, detail) VALUES (?, ?)",
            (action, detail),
        )
        self.conn.commit()

    def bump_daily_stat(self, field: str) -> None:
        today = date.today().isoformat()
        self.conn.execute(
            f"""INSERT INTO daily_stats (date, {field}) VALUES (?, 1)
                ON CONFLICT(date) DO UPDATE SET {field} = {field} + 1""",
            (today,),
        )
        self.conn.commit()

    def get_daily_stats(self, days: int = 7) -> list[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM daily_stats WHERE date >= date('now', ?) ORDER BY date DESC",
            (f"-{days} days",),
        ).fetchall()
