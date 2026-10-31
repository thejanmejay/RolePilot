"""LinkedIn job search URL parameter builder."""

from __future__ import annotations

from urllib.parse import urlencode

from linkedin_hunter.config import SearchConfig

BASE_URL = "https://www.linkedin.com/jobs/search/?"

# LinkedIn filter parameter mappings — f_TPR values are seconds
DATE_POSTED_MAP = {
    "past-hour": "r3600",
    "past-3h": "r10800",
    "past-6h": "r21600",
    "past-12h": "r43200",
    "past-24h": "r86400",
    "past-week": "r604800",
    "past-month": "r2592000",
    "any": "",
}

EXPERIENCE_LEVEL_MAP = {
    "internship": "1",
    "entry": "2",
    "associate": "3",
    "mid-senior": "4",
    "director": "5",
    "executive": "6",
}

JOB_TYPE_MAP = {
    "full-time": "F",
    "part-time": "P",
    "contract": "C",
    "temporary": "T",
    "internship": "I",
    "volunteer": "V",
    "other": "O",
}

REMOTE_MAP = {
    "on-site": "1",
    "remote": "2",
    "hybrid": "3",
}

SORT_MAP = {
    "relevant": "R",
    "recent": "DD",
}

# Common LinkedIn geoId values for quick reference
GEO_IDS = {
    "worldwide": "92000000",
    "united states": "103644278",
    "india": "102713980",
    "united kingdom": "101165590",
    "canada": "101174742",
    "germany": "101282230",
    "australia": "101452733",
    "remote": "",  # No geoId needed for remote
}


def build_search_url(search: SearchConfig, start: int = 0) -> str:
    """Build a LinkedIn job search URL from config parameters."""
    params: dict[str, str] = {
        "keywords": search.keywords,
    }

    # Clean location: If location contains comma-separated values like "Noida, Remote",
    # extract the real geographic city and map "remote" to LinkedIn's work mode filter.
    loc = (search.location or "").strip()
    remote_tokens: list[str] = []
    if loc:
        parts = [p.strip() for p in loc.split(",") if p.strip()]
        geo_parts: list[str] = []
        for p in parts:
            if p.lower() in ("remote", "work from home", "wfh"):
                remote_tokens.append("remote")
            else:
                geo_parts.append(p)
        cleaned_loc = ", ".join(geo_parts) if geo_parts else ("India" if remote_tokens else loc)
    else:
        cleaned_loc = ""

    # Use geoId if provided, otherwise fall back to cleaned location text
    if search.geo_id:
        params["geoId"] = search.geo_id
    elif cleaned_loc:
        geo_id = GEO_IDS.get(cleaned_loc.lower(), "")
        if geo_id:
            params["geoId"] = geo_id
        else:
            params["location"] = cleaned_loc

    if search.distance is not None:
        params["distance"] = str(search.distance)

    if search.date_posted and search.date_posted in DATE_POSTED_MAP:
        val = DATE_POSTED_MAP[search.date_posted]
        if val:
            params["f_TPR"] = val

    if search.experience_level:
        levels = [
            EXPERIENCE_LEVEL_MAP[lvl.strip()]
            for lvl in search.experience_level.split(",")
            if lvl.strip() in EXPERIENCE_LEVEL_MAP
        ]
        if levels:
            params["f_E"] = ",".join(levels)

    if search.job_type and search.job_type in JOB_TYPE_MAP:
        params["f_JT"] = JOB_TYPE_MAP[search.job_type]

    # Work Mode / Remote filter: support single mode or comma-separated list like "remote,hybrid,on-site"
    all_remote: list[str] = []
    if search.remote:
        all_remote.extend([r.strip().lower() for r in search.remote.split(",") if r.strip()])
    all_remote.extend(remote_tokens)

    if all_remote:
        wt_codes: list[str] = []
        for r in all_remote:
            if r in REMOTE_MAP and REMOTE_MAP[r] not in wt_codes:
                wt_codes.append(REMOTE_MAP[r])
        if wt_codes:
            params["f_WT"] = ",".join(wt_codes)

    if search.easy_apply_only:
        params["f_AL"] = "true"

    if search.sort_by and search.sort_by in SORT_MAP:
        params["sortBy"] = SORT_MAP[search.sort_by]

    if search.salary_min > 0:
        params["f_SB2"] = str(search.salary_min)

    if start > 0:
        params["start"] = str(start)

    url = BASE_URL + urlencode(params)
    return url
