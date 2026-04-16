"""Persistent user memory for form field answers.

Stores question→answer pairs so the bot never asks the same question twice.
Uses normalized question text as keys for fuzzy matching across job applications.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Optional

import yaml

from linkedin_hunter.config import get_project_root
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

MEMORY_FILE = "data/user_memory.yaml"


def _normalize(text: str) -> str:
    """Normalize question text for consistent hashing.

    Strips whitespace, lowercases, removes punctuation and extra spaces
    so slight variations of the same question map to the same key.
    """
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)      # remove punctuation
    text = re.sub(r"\s+", " ", text).strip()  # collapse whitespace
    return text


def _hash_question(text: str) -> str:
    """Create a short hash key from normalized question text."""
    normalized = _normalize(text)
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


class UserMemory:
    """Persistent cache of user-provided answers to form questions.

    Structure of the YAML file:
        entries:
          <hash>:
            question: "Original question text"
            answer: "User's answer"
            normalized: "normalized question text"
            times_used: 3
    """

    def __init__(self, memory_path: Optional[Path] = None):
        if memory_path is None:
            memory_path = get_project_root() / MEMORY_FILE
        self._path = memory_path
        self._entries: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        """Load memory from YAML file."""
        if not self._path.exists():
            self._entries = {}
            return
        try:
            with open(self._path) as f:
                raw = yaml.safe_load(f) or {}
            self._entries = raw.get("entries", {})
            log.info("Loaded %d entries from user memory", len(self._entries))
        except Exception as e:
            log.warning("Failed to load user memory: %s", e)
            self._entries = {}

    def _save(self) -> None:
        """Persist memory to YAML file."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._path, "w") as f:
            yaml.dump({"entries": self._entries}, f, default_flow_style=False,
                       allow_unicode=True, sort_keys=False)

    def lookup(self, question: str) -> Optional[str]:
        """Look up a previously stored answer for this question.

        Uses both exact hash match and fuzzy normalized-text match.
        Returns the answer string or None.
        """
        key = _hash_question(question)

        # Exact hash match
        if key in self._entries:
            entry = self._entries[key]
            entry["times_used"] = entry.get("times_used", 0) + 1
            self._save()
            log.info("Memory hit for '%s' → '%s'", question[:50], entry["answer"])
            return entry["answer"]

        # Fuzzy match: compare normalized text against all stored entries
        normalized = _normalize(question)
        for _k, entry in self._entries.items():
            stored_norm = entry.get("normalized", "")
            if stored_norm and _fuzzy_match(normalized, stored_norm):
                entry["times_used"] = entry.get("times_used", 0) + 1
                self._save()
                log.info("Fuzzy memory hit for '%s' → '%s'", question[:50], entry["answer"])
                return entry["answer"]

        return None

    def store(self, question: str, answer: str) -> None:
        """Store a new question→answer pair in memory."""
        key = _hash_question(question)
        self._entries[key] = {
            "question": question.strip(),
            "answer": answer.strip(),
            "normalized": _normalize(question),
            "times_used": 1,
        }
        self._save()
        log.info("Stored in memory: '%s' → '%s'", question[:50], answer)

    def get_all(self) -> dict[str, dict]:
        """Return all stored entries (for debugging/display)."""
        return dict(self._entries)


def _fuzzy_match(a: str, b: str) -> bool:
    """Check if two normalized question strings are similar enough.

    Uses token overlap: if 80%+ of words in the shorter string appear
    in the longer string, consider it a match.
    """
    words_a = set(a.split())
    words_b = set(b.split())

    if not words_a or not words_b:
        return False

    shorter, longer = (words_a, words_b) if len(words_a) <= len(words_b) else (words_b, words_a)
    overlap = len(shorter & longer)
    threshold = 0.8
    return overlap / len(shorter) >= threshold
