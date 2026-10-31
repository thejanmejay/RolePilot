---
name: rolepilot-security
description: >-
  Enforces RolePilot security protocols, the Triple-Key Live-Submission Guard, SSRF protections,
  candidate data privacy, session credential safety, and authorization boundaries.
  Activate this skill when reviewing security boundaries, handling external URLs, or managing credentials.
---

# RolePilot — Security & Privacy Skill

This skill enforces security controls, data protection boundaries, threat mitigations, and safety interlocks across RolePilot.

## 1. Activation Conditions
Activate this skill when:
- Reviewing or modifying the Triple-Key Live-Submission Guard.
- Processing user-supplied URLs (portfolio extraction, website audits, webhooks).
- Handling sensitive session tokens (LinkedIn `li_at` cookie) or candidate resumes.
- Implementing authentication, authorization, or user isolation boundaries.
- Preventing Server-Side Request Forgery (SSRF), Denial of Service (DoS), or credential leakage.

## 2. Required Inspection Steps
1. **Triple-Key Guard Implementations**:
   - Frontend validation: [frontend/src/components/automation/TriggerAutomationModal.tsx](file:///Users/janamjay/linkedin/frontend/src/components/automation/TriggerAutomationModal.tsx) and [SafetyGuardPanel.tsx](file:///Users/janamjay/linkedin/frontend/src/components/automation/SafetyGuardPanel.tsx).
   - Backend validation: [backend/app/workers/linkedin_worker.py](file:///Users/janamjay/linkedin/backend/app/workers/linkedin_worker.py).
2. **SSRF Protections**:
   - Inspect `validate_safe_url` and `is_private_or_restricted_ip` in [backend/app/services/portfolio_extractor.py](file:///Users/janamjay/linkedin/backend/app/services/portfolio_extractor.py).
3. **Session Masking & Storage**:
   - Inspect [frontend/src/components/linkedin/LinkedInConsentModal.tsx](file:///Users/janamjay/linkedin/frontend/src/components/linkedin/LinkedInConsentModal.tsx) for masked password inputs (`type="password"`) and safe credential wipe handlers.

## 3. Decision Rules & Security Protocols
- **The Triple-Key Invariant**:
  - `dry_run is False`
  - `allow_live_submission is True`
  - `live_submission_confirmation == "CONFIRM_REAL_SUBMISSION"`
  - Never bypass, weaken, or auto-fill this confirmation string in automated workflows or tests.
- **SSRF Defense-in-Depth**:
  - Always resolve hostnames via `socket.getaddrinfo` prior to HTTP connection.
  - Reject private IPs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.1`), link-local / cloud metadata (`169.254.169.254`), multicast, and reserved ranges.
  - Reject non-HTTP/HTTPS schemes (`file://`, `ftp://`, `gopher://`, `data:`, `javascript:`).
  - Strip embedded credentials (`user:pass@host`).
  - Follow no more than 3 redirects, re-validating the destination IP on each hop.
  - Enforce hard limits: $2\text{ MB}$ max response body and $8\text{s}$ timeout.
- **Credential & Secret Protection**:
  - Never write candidate passwords or raw `li_at` session cookies to persistent log files or terminal output.
  - Clear in-memory session tokens upon disconnect or logout.
  - Mask tokens in the UI by default with an eye reveal toggle.
- **Candidate Data Privacy**:
  - Resumes and extracted data are strictly scoped to the authenticated `user_id`.
  - Data is never repurposed for external AI model training without separate user consent.

## 4. Implementation Workflow
1. **Threat Modeling**: Identify the untrusted input (uploaded file bytes, user-supplied URL, session token).
2. **Input Sanitization**: Validate file types, parse URLs securely, check IP address ranges, and enforce size limits before allocating resources.
3. **Authorization Check**: Enforce `user_id` scoping at the database query level on every endpoint.
4. **Audit Logging**: Log security events (e.g. SSRF blocked attempt, failed authentication) with sanitized metadata, never logging raw payload secrets.

## 5. Verification & Acceptance Criteria
- Pytest security suite passes:
  ```bash
  source linkedin-hunter/.venv/bin/activate && PYTHONPATH=.:src pytest tests/test_profile_extraction_service.py -k "ssrf"
  ```
- Node security and safety guard tests pass:
  ```bash
  node --test tests/test_responsive_ui_and_design_system.mjs
  ```
- Zero leakage of secrets in application logs.

## 6. Final Report Format
Document:
- Security mechanisms verified or added.
- SSRF and DoS protection boundaries confirmed.
- Candidate isolation and credential protection status.
- Exact test verification output.
