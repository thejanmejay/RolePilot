"""Fill Easy Apply form fields from config, resume data, and pattern matching."""

from __future__ import annotations

import asyncio
import re
import random
from pathlib import Path
from typing import Optional

from playwright.async_api import Page

from linkedin_hunter.browser.humanize import short_delay
from linkedin_hunter.config import HunterConfig, get_project_root
from linkedin_hunter.forms.detector import FormField, FieldType
from linkedin_hunter.forms.memory import UserMemory
from linkedin_hunter.forms.questions import (
    match_answer, match_yes_no, match_multi_option, match_select_option,
)
from linkedin_hunter.forms.user_prompt import prompt_user_for_input
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

# Module-level user memory instance (loaded once, reused across calls)
_user_memory: UserMemory | None = None


def _get_memory() -> UserMemory:
    """Get or initialize the singleton UserMemory instance."""
    global _user_memory
    if _user_memory is None:
        _user_memory = UserMemory()
    return _user_memory


async def fill_form_fields(
    page: Page,
    fields: list[FormField],
    config: HunterConfig,
    resume_text: str | None = None,
) -> tuple[int, int, bool]:
    """Fill all detected form fields. Returns (filled_count, skipped_count, required_failed)."""
    filled = 0
    skipped = 0
    required_failed = False

    for field in fields:
        try:
            success = await _fill_field(page, field, config, resume_text)
            if success:
                filled += 1
            else:
                skipped += 1
                if field.required:
                    required_failed = True
                    log.warning("Required field '%s' could not be filled", field.label)
        except Exception as e:
            log.warning("Error filling field '%s': %s", field.label, e)
            skipped += 1
            if field.required:
                required_failed = True

    log.info("Filled %d fields, skipped %d (required_failed=%s)", filled, skipped, required_failed)
    return filled, skipped, required_failed


async def _fill_field(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a single form field. Returns True if filled."""
    await short_delay()

    if field.field_type == FieldType.FILE_UPLOAD:
        return await _fill_file_upload(field, config)

    if field.field_type == FieldType.TEXT:
        return await _fill_text(page, field, config, resume_text)

    if field.field_type == FieldType.TEXTAREA:
        return await _fill_textarea(page, field, config, resume_text)

    if field.field_type == FieldType.SELECT:
        return await _fill_select(page, field, config, resume_text)

    if field.field_type == FieldType.RADIO:
        return await _fill_radio(page, field, config, resume_text)

    if field.field_type == FieldType.CHECKBOX:
        return await _fill_checkbox(page, field, config)

    return False


def _is_numeric_field(field: FormField) -> bool:
    """Check if a field expects a numeric answer based on its label."""
    q = field.label.lower()
    numeric_indicators = [
        r"(in\s*)?days?\b",           # "in days", "days"
        r"out\s*of\s*\d+",            # "out of 10"
        r"rate\s*(yourself|your)",     # "rate yourself"
        r"scale\s*of",                # "scale of 1-10"
        r"on\s*a\s*scale",            # "on a scale"
        r"how\s*many\s*(day|month|year|hour)", # "how many days"
        r"\(\s*in\s*(days?|months?|years?|hours?)\s*\)",  # "(in days)"
        r"number\s*of\s*(day|month|year)",  # "number of days"
        r"specify\s*in\s*(day|month|year)",  # "specify in days"
    ]
    return any(re.search(p, q) for p in numeric_indicators)


def _get_numeric_answer(label: str, config: HunterConfig) -> Optional[str]:
    """Get a numeric answer for fields that require numbers."""
    q = label.lower()

    # Rating / scale questions: extract scale ceiling (e.g. "out of 5" -> "5", "scale of 10" -> "10")
    scale_match = re.search(r"(?:out\s*of|scale\s*of|on\s*a\s*scale\s*of\s*(?:1|0)\s*to)\s*(\d+)", q)
    if scale_match:
        scale_max = int(scale_match.group(1))
        return str(scale_max)

    if re.search(r"(rate\s*(yourself|your)|how\s*would\s*you\s*rate|on\s*a\s*scale)", q):
        return "5"

    # Notice period in days / days available to join
    if re.search(r"(notice\s*period|notice\s*days|days\s*(of\s*)?notice|how\s*many\s*days.*notice|days.*(available|to).*join)", q):
        return str(config.profile.notice_period_days)

    # Split experience questions: additional months vs total years
    if re.search(r"(additional\s*months?.*experience|months?.*additional.*experience)", q):
        return str(config.profile.months_of_experience)

    if re.search(r"(how\s*many\s*months?.*experience|months?\s*of\s*(professional\s*)?experience)", q):
        return str(config.profile.months_of_experience)

    if re.search(r"(total\s*years?.*experience|how\s*many\s*years?.*experience|years?\s*of\s*(professional\s*)?experience|overall.*experience)", q):
        return str(config.profile.years_of_experience)

    # Salary in numeric-only field (only when generic, not unit-specific)
    if re.search(r"(salary|compensation|ctc|pay|earning|remuneration).*(number|amount|figure|numeric)?", q):
        if not re.search(r"(in-hand|take-home|month|lakh|lpa)", q):
            return config.answers.desired_salary or None

    return None


def _extract_from_resume(question: str, resume_text: str) -> Optional[str]:
    """Try to extract an answer from resume text based on the question asked.

    Handles common Easy Apply questions like university name, degree, GPA, links.
    """
    q = question.lower().strip()

    # If this is clearly a Yes/No question, let yes/no matcher handle it
    if re.search(r"^(have\s+you|did\s+you|do\s+you|are\s+you|will\s+you|can\s+you|is\s+there)", q):
        return None

    # Years of experience with a specific technology
    tech_match = re.search(r"years?.*(experience|proficien).*(with|in|using)?\s*(\w[\w\s#\+\.]*)", q)
    if not tech_match:
        tech_match = re.search(r"how\s+(?:many\s+)?years?.*?(\w[\w\s#\+\.]+)", q)
    if tech_match:
        tech = tech_match.group(tech_match.lastindex or 1).strip().lower()
        if re.search(re.escape(tech), resume_text, re.IGNORECASE):
            return None  # Let config custom patterns handle this

    # University / school name (ONLY when asking for name of institution, NOT degree completion Yes/No)
    if (re.search(r"(?i)(university|school|college|alma mater)\s*(name|\b)|name\s*of\s*(university|school|college|institute)", q)
            and not re.search(r"(?i)(degree|bachelor|completed|finish|level|hold|have you)", q)):
        edu_match = re.search(
            r"(?:university|college|institute|school)\s+of\s+[\w\s]+|"
            r"[\w\s]+(?:university|college|institute|school)",
            resume_text, re.IGNORECASE,
        )
        if edu_match:
            return edu_match.group(0).strip()

    # Degree
    if re.search(r"(?i)(degree|qualification|education level)", q):
        for pattern, degree in [
            (r"(?i)\bph\.?d\.?\b", "Doctorate"),
            (r"(?i)\bm\.?s\.?\b|master", "Master's Degree"),
            (r"(?i)\bm\.?b\.?a\.?\b", "Master's Degree"),
            (r"(?i)\bb\.?s\.?\b|bachelor", "Bachelor's Degree"),
            (r"(?i)\bb\.?a\.?\b", "Bachelor's Degree"),
            (r"(?i)\bassociate", "Associate's Degree"),
        ]:
            if re.search(pattern, resume_text):
                return degree

    # GPA
    if re.search(r"(?i)\bgpa\b", q):
        gpa_match = re.search(r"(?i)gpa[:\s]*([0-4]\.\d{1,2})", resume_text)
        if gpa_match:
            return gpa_match.group(1)

    # LinkedIn profile
    if re.search(r"(?i)linkedin.*(url|profile|link)", q):
        li_match = re.search(r"linkedin\.com/in/[\w\-]+", resume_text, re.IGNORECASE)
        if li_match:
            return "https://www." + li_match.group(0)

    # GitHub / portfolio
    if re.search(r"(?i)(github|portfolio|website|personal.*(url|site|link))", q):
        gh_match = re.search(r"github\.com/[\w\-]+", resume_text, re.IGNORECASE)
        if gh_match:
            return "https://" + gh_match.group(0)

    return None


async def _fill_text(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a text input field."""
    inp_type = field.input_type or "text"
    try:
        inp_type = (await field.element.get_attribute("type")) or inp_type
    except Exception:
        pass

    # Skip if already filled
    if field.current_value:
        log.info(
            "[FIELD] question=%r type=text input_type=%s name=%r id=%r value=%r required=%s prefilled=True",
            field.label, inp_type, field.name, field.element_id, field.current_value, field.required,
        )
        return True

    # Try config/profile pattern matching first
    answer = match_answer(field.label, config.answers, config.profile)

    # Check if this is a numeric field or type="number" and the answer might not be numeric
    is_numeric = inp_type == "number" or _is_numeric_field(field)
    if answer and is_numeric:
        # Validate the answer is numeric; if not, get a numeric one
        try:
            float(answer)
        except ValueError:
            numeric = _get_numeric_answer(field.label, config)
            if numeric:
                answer = numeric
            else:
                answer = None

    # If no answer yet, try numeric detection
    if answer is None and is_numeric:
        answer = _get_numeric_answer(field.label, config)

    # Fallback: try extracting from resume
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    # Check user memory before falling back
    if answer is None:
        memory = _get_memory()
        answer = memory.lookup(field.label)

    # Last resort for required fields: try generic fallback
    if answer is None and field.required:
        answer = _text_fallback(field.label, config)

    # Still stuck on a required field → ask the user with blinking prompt
    if answer is None and field.required:
        log.info("[TEXT] Question=%r field_type=%r", field.label, inp_type)
        log.info("[TEXT] No automatic answer found; prompting user")
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="text",
        )
        log.info("[TEXT] User prompt returned: %r", user_answer)
        if user_answer:
            answer = user_answer

    # Final validation guards for typed inputs
    if answer is not None:
        if is_numeric:
            try:
                float(answer.strip())
            except ValueError:
                log.warning("Rejecting non-numeric answer %r for numeric field %r", answer, field.label)
                answer = None
        elif inp_type == "url" or re.search(r"(url|link|website|portfolio)\b", field.label, re.IGNORECASE):
            if answer.strip().lower() in {"yes", "no", "true", "false", "n/a"}:
                log.warning("Rejecting invalid answer %r for URL field %r", answer, field.label)
                answer = None

    # Diagnostic logging for field and value
    log.info(
        "[FIELD] question=%r type=text input_type=%s name=%r id=%r value=%r required=%s",
        field.label, inp_type, field.name, field.element_id, answer, field.required,
    )

    if answer is None:
        log.debug("No answer for text field: %s", field.label)
        return not field.required  # OK to skip non-required fields

    await field.element.click()
    await asyncio.sleep(random.uniform(0.1, 0.3))

    # Fast fill for URLs, email, numbers, or specific identifiers to prevent drops/autocomplete bugs
    is_url_or_fast_field = (
        is_numeric
        or re.search(r"(url|link|profile|website|portfolio|email|phone|ctc|salary|gpa)", field.label, re.IGNORECASE)
        or answer.startswith("http://")
        or answer.startswith("https://")
        or "@" in answer
    )

    if is_url_or_fast_field:
        await field.element.fill(answer)
    else:
        await field.element.fill("")
        for char in answer:
            await page.keyboard.type(char, delay=random.uniform(20, 60))

    # Handle typeahead/autocomplete dropdowns (only for city/location-like fields)
    if not is_url_or_fast_field and re.search(r"(city|state|location|address|country|university|school|company)", field.label, re.IGNORECASE):
        await asyncio.sleep(0.6)
        typeahead_option = await page.query_selector(
            "div.basic-typeahead__triggered-content li:first-child, "
            "div.search-typeahead-v2__hit:first-child, "
            "div[data-test-single-typeahead-entity-form-search-result]:first-child"
        )
        if typeahead_option:
            await typeahead_option.click()
            log.info("Selected typeahead suggestion for '%s'", field.label)
            await asyncio.sleep(0.2)

    log.info("Filled text field '%s' with '%s'", field.label, answer)
    return True


def _text_fallback(label: str, config: HunterConfig) -> Optional[str]:
    """Provide sensible fallback answers for required text fields."""
    q = label.lower()

    # Notice period in days
    if re.search(r"(notice\s*period|notice\s*days|days\s*(of\s*)?notice|how\s*many\s*days.*notice)", q):
        return str(config.profile.notice_period_days)

    # Catch-all "years of experience in <anything>" → default to profile years
    if re.search(r"(years?|how many|how much).*(experience|work|proficien)", q):
        return str(config.profile.years_of_experience)

    # Any "how many" question with no match → try numeric
    if re.search(r"how\s*many", q):
        return str(config.profile.years_of_experience)

    # Referral / who referred → N/A
    if re.search(r"(referr|who.*refer|employee.*name|referred\s*by)", q):
        return "N/A"

    # LinkedIn URL patterns that weren't caught
    if re.search(r"(?i)(linkedin|perfil)", q):
        return config.profile.linkedin_url or ""

    # Current company / employer
    if re.search(r"(current|present).*(company|employer|organization)", q):
        return "N/A"

    # Expected joining date / start date
    if re.search(r"(join|start).*(date|when)", q):
        return f"{config.profile.notice_period_days} days"

    return None


async def _fill_textarea(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a textarea field."""
    if field.current_value:
        log.info(
            "[FIELD] question=%r type=textarea input_type=textarea name=%r id=%r value=%r required=%s prefilled=True",
            field.label, field.name, field.element_id, field.current_value, field.required,
        )
        return True

    answer = match_answer(field.label, config.answers, config.profile)

    # Fallback: try extracting from resume
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    # Check user memory before falling back
    if answer is None:
        memory = _get_memory()
        answer = memory.lookup(field.label)

    # Fallback for required textareas: try smart defaults
    if answer is None and field.required:
        answer = _textarea_fallback(field.label, config)

    # Still stuck on a required field → ask the user
    if answer is None and field.required:
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="textarea",
        )
        if user_answer:
            answer = user_answer

    log.info(
        "[FIELD] question=%r type=textarea input_type=textarea name=%r id=%r value=%r required=%s",
        field.label, field.name, field.element_id, answer, field.required,
    )

    if answer is None:
        return not field.required

    await field.element.click()
    await field.element.fill(answer)
    log.info("Filled textarea '%s'", field.label)
    return True


def _textarea_fallback(label: str, config: HunterConfig) -> Optional[str]:
    """Provide sensible fallback answers for required textareas."""
    q = label.lower()

    # "Where did you hear" / "How did you hear" — multi-language
    if re.search(r"(where|how).*(hear|learn|find|know)", q):
        return config.answers.how_did_you_hear or "LinkedIn"
    if re.search(r"(c[oó]mo|onde|comment|wie|dove).*(enterar|conhec|soube|avez|erfahren|scoperto|enteraste)", q):
        return config.answers.how_did_you_hear or "LinkedIn"

    # Cover letter / tell us about yourself / why interested — multi-language
    if re.search(r"(cover.?letter|tell.*(us|me).*about|why.*(interest|apply|join)|additional.?info)", q):
        return config.answers.cover_letter or "I am excited about this opportunity."
    if re.search(r"(carta.*(presentaci|motivaci)|lettre.*motivation|por.?qu[eé].*(interes|aplicar))", q):
        return config.answers.cover_letter or "I am excited about this opportunity."

    # Chat channels / communication / contact method
    if re.search(r"(chat|channel|zalo|whatsapp|telegram|contact.*(method|prefer)|communication|canal)", q):
        return "LinkedIn"

    # Referral / who referred — multi-language
    if re.search(r"(referr|who.*refer|familiar.*amigo|pariente.*trabaj|connaissez.*ami)", q):
        return "N/A"
    if re.search(r"(tiene.*familiar|tiene.*amigo|tiene.*conocido).*(trabaj|empresa|compañía)", q):
        return "No"

    # Reside / live in a specific location — check if it's asking about a different country
    if re.search(r"(reside|live|located|work from|currently.*(in|at|based))", q):
        user_country = (config.profile.country or "").lower()
        user_city = (config.profile.city or "").lower()
        if user_country and user_country in q:
            return "Yes"
        if user_city and user_city in q:
            return "Yes"
        if re.search(r"(?i)(vietnam|japan|china|korea|brazil|germany|uk|australia|canada|france|spain|italy|portugal)", q):
            return "No"
        return f"{config.profile.city}, {config.profile.country}" if config.profile.city else "No"

    # Anything about experience / skills / describe — multi-language
    if re.search(r"(describe|explain|experience|skill|background|summary|about.*(you|yourself))", q):
        return config.answers.cover_letter or "I have relevant experience for this role."
    if re.search(r"(descri[bp]|explica|experiencia|habilidad|competencia|résumé|zusammenfassung)", q):
        return config.answers.cover_letter or "I have relevant experience for this role."

    # LinkedIn URL / profile — multi-language
    if re.search(r"(linkedin|perfil.*linkedin|profil.*linkedin)", q):
        return config.profile.linkedin_url or ""

    # Generic required textarea — use a brief safe answer
    log.warning("No specific fallback for required textarea: '%s', using generic", label[:60])
    return "N/A"


def match_option_to_choices(user_answer: str, options: list[str]) -> Optional[str]:
    """Strictly match a user's answer string to one of the available options.

    Priority order:
      1. Strict Yes/No matching for Yes/No option sets
      2. Exact normalized text match (case-insensitive, whitespace-trimmed)
      3. Numeric value extracted from option labels (e.g. '9' -> '9 months', '4' -> '3-5 years')
      4. 1-based positional index as fallback (e.g. '2' -> 2nd option if options have no matching number)
      5. Partial substring match (only if length >= 4)
    """
    if not user_answer or not options:
        return None

    cleaned = user_answer.strip().lower()

    # 1. Strict Yes/No matching if options contain Yes or No
    has_yes = any(opt.strip().lower() == "yes" for opt in options)
    has_no = any(opt.strip().lower() == "no" for opt in options)

    if has_yes or has_no:
        if cleaned in {"yes", "y", "true"}:
            for opt in options:
                if opt.strip().lower() == "yes":
                    return opt
        elif cleaned in {"no", "n", "false"}:
            for opt in options:
                if opt.strip().lower() == "no":
                    return opt
        # If this is purely a Yes/No option set, don't allow arbitrary loose matching
        clean_opts = {opt.strip().lower() for opt in options}
        if clean_opts.issubset({"yes", "no", "select an option", ""}):
            return None

    # 2. Exact match (case-insensitive, whitespace-trimmed)
    for opt in options:
        if opt.strip().lower() == cleaned:
            return opt

    # 3. Numeric value extracted from option labels
    # If user_answer is numeric (e.g. '9', '0', '10', '2'), find the option whose label represents this number
    if cleaned.isdigit() or re.match(r"^\d+(\.\d+)?$", cleaned):
        num_val = float(cleaned) if "." in cleaned else int(cleaned)

        # 3a. Exact numeric match at start of option label (e.g. '9' -> '9 months', '0' -> '0 month', '10' -> '10 months')
        for opt in options:
            opt_stripped = opt.strip()
            m = re.match(r"^(\d+)\b", opt_stripped)
            if m and int(m.group(1)) == num_val:
                return opt

        # 3b. Range match (e.g. '4' -> '3-5 years', '3 - 5')
        for opt in options:
            opt_stripped = opt.strip()
            range_match = re.match(r"(\d+)\s*[-–]\s*(\d+)", opt_stripped)
            if range_match:
                low, high = int(range_match.group(1)), int(range_match.group(2))
                if low <= num_val <= high:
                    return opt

        # 3c. Option contains standalone number matching user number (e.g. "Level 9")
        for opt in options:
            opt_stripped = opt.strip()
            num_matches = re.findall(r"\b\d+\b", opt_stripped)
            if num_matches and any(int(n) == num_val for n in num_matches):
                return opt

        # 4. 1-based positional index fallback (e.g. '2' -> options[1] when options lack numbers)
        if isinstance(num_val, int) and 1 <= num_val <= len(options):
            candidate = options[num_val - 1]
            if candidate.strip().lower() != "select an option":
                return candidate

    # 5. Partial substring match ONLY if user_answer is a non-trivial substring of opt (and not vice-versa)
    if len(cleaned) >= 4:
        for opt in options:
            if cleaned in opt.strip().lower():
                return opt

    return None


async def _fill_select(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a select dropdown."""
    # Check if already has a selected value (LinkedIn pre-fills some selects)
    try:
        current_val = await field.element.input_value()
        if current_val and current_val.strip() and current_val != "Select an option":
            log.info(
                "[FIELD] question=%r type=select input_type=select name=%r id=%r value=%r required=%s prefilled=True",
                field.label, field.name, field.element_id, current_val, field.required,
            )
            return True
    except Exception:
        pass

    # Try Yes/No matching first (only for questions that are clearly yes/no)
    yes_no = match_yes_no(field.label, config.answers)
    if yes_no is not None:
        target = "Yes" if yes_no else "No"
        for opt in field.options:
            if opt.lower() == target.lower():
                await field.element.select_option(label=opt)
                log.info(
                    "[FIELD] question=%r type=select input_type=select name=%r id=%r value=%r required=%s",
                    field.label, field.name, field.element_id, opt, field.required,
                )
                return True

    # Try text answer matching from config
    answer = match_answer(field.label, config.answers, config.profile)

    # Fallback: try resume
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    if answer:
        matched = match_option_to_choices(answer, field.options)
        if matched:
            await field.element.select_option(label=matched)
            log.info(
                "[FIELD] question=%r type=select input_type=select name=%r id=%r value=%r required=%s (answer match)",
                field.label, field.name, field.element_id, matched, field.required,
            )
            return True

    # Try SELECT_OPTION_PATTERNS for known question types
    if field.options:
        select_match = match_select_option(field.label, field.options)
        if select_match:
            await field.element.select_option(label=select_match)
            log.info(
                "[FIELD] question=%r type=select input_type=select name=%r id=%r value=%r required=%s (select pattern)",
                field.label, field.name, field.element_id, select_match, field.required,
            )
            return True

    # Check user memory for select fields
    if field.options:
        memory = _get_memory()
        mem_answer = memory.lookup(field.label)
        if mem_answer:
            matched = match_option_to_choices(mem_answer, field.options)
            if matched:
                await field.element.select_option(label=matched)
                log.info(
                    "[FIELD] question=%r type=select input_type=select name=%r id=%r value=%r required=%s (memory)",
                    field.label, field.name, field.element_id, matched, field.required,
                )
                return True

    # If required and has options, ask user before falling back to smart defaults
    if field.required and field.options:
        log.info("[SELECT] Question=%r options=%r", field.label, field.options)
        log.info("[SELECT] No automatic answer found; prompting user")
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="select",
            options=field.options,
        )
        log.info("[SELECT] User prompt returned: %r", user_answer)
        if user_answer:
            log.info("[SELECT] Matching user answer=%r against options=%r", user_answer, field.options)
            matched = match_option_to_choices(user_answer, field.options)
            if matched:
                await field.element.select_option(label=matched)
                log.info(
                    "[FIELD] question=%r type=select input_type=select name=%r id=%r value=%r required=%s (user prompt)",
                    field.label, field.name, field.element_id, matched, field.required,
                )
                return True
            log.warning("[SELECT] User answer %r did not match any option: %r", user_answer, field.options)

    # If required and has options, try smart fallback
    # If required and has options, only fallback on explicit confirmation/acknowledgement words
    if field.required and field.options:
        q = field.label.lower()

        # Only standard confirmation / acknowledgement selects
        if re.search(r"(agree|consent|confirm|acknowledge|certif)", q):
            for default in ["confirmed", "acknowledged", "i agree", "agree", "yes"]:
                for opt in field.options:
                    if opt.lower() == default or opt.lower().startswith(default):
                        await field.element.select_option(label=opt)
                        log.info(
                            "[FIELD] question=%r type=select input_type=select name=%r id=%r value=%r required=%s (confirmation fallback)",
                            field.label, field.name, field.element_id, opt, field.required,
                        )
                        return True

        # Do NOT guess Yes or pick arbitrary options! Fail safely so application is not submitted with wrong data.
        log.warning("No answer found for required select '%s' (options: %s) — skipping field", field.label, field.options)
        return False

    return not field.required


async def _fill_radio(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a radio button group."""
    log.info("Filling radio field: '%s' (options: %s)", field.label, field.options)

    # 1. Try Yes/No matching (for simple Yes/No radio groups)
    yes_no = match_yes_no(field.label, config.answers)
    if yes_no is not None:
        target = "Yes" if yes_no else "No"
        log.info("Yes/No match for '%s': selecting '%s'", field.label, target)
        clicked = await _click_radio_option(page, field, target)
        if clicked:
            log.info(
                "[FIELD] question=%r type=radio input_type=radio name=%r id=%r value=%r required=%s",
                field.label, field.name, field.element_id, target, field.required,
            )
            return True

    # 2. Try multi-option matching (citizenship, gender, disability, veteran, etc.)
    if field.options:
        multi_match = match_multi_option(field.label, field.options)
        if multi_match:
            log.info("Multi-option match for '%s': selecting '%s'", field.label, multi_match)
            clicked = await _click_radio_option(page, field, multi_match)
            if clicked:
                log.info(
                    "[FIELD] question=%r type=radio input_type=radio name=%r id=%r value=%r required=%s",
                    field.label, field.name, field.element_id, multi_match, field.required,
                )
                return True

    # 3. Try text answer matching from config/custom patterns
    answer = match_answer(field.label, config.answers, config.profile)
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    if answer:
        # Try direct match first
        clicked = await _click_radio_option(page, field, answer)
        if clicked:
            log.info(
                "[FIELD] question=%r type=radio input_type=radio name=%r id=%r value=%r required=%s",
                field.label, field.name, field.element_id, answer, field.required,
            )
            return True
        matched = match_option_to_choices(answer, field.options)
        if matched:
            clicked = await _click_radio_option(page, field, matched)
            if clicked:
                log.info(
                    "[FIELD] question=%r type=radio input_type=radio name=%r id=%r value=%r required=%s",
                    field.label, field.name, field.element_id, matched, field.required,
                )
                return True

    # 4. Check user memory
    memory = _get_memory()
    mem_answer = memory.lookup(field.label)
    if mem_answer:
        matched = match_option_to_choices(mem_answer, field.options)
        if matched:
            clicked = await _click_radio_option(page, field, matched)
            if clicked:
                log.info(
                    "[FIELD] question=%r type=radio input_type=radio name=%r id=%r value=%r required=%s (memory)",
                    field.label, field.name, field.element_id, matched, field.required,
                )
                return True

    # 5. Ask user if still stuck on required field
    if field.required:
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="radio",
            options=field.options,
        )
        if user_answer:
            matched = match_option_to_choices(user_answer, field.options)
            if matched:
                clicked = await _click_radio_option(page, field, matched)
                if clicked:
                    log.info(
                        "[FIELD] question=%r type=radio input_type=radio name=%r id=%r value=%r required=%s (user prompt)",
                        field.label, field.name, field.element_id, matched, field.required,
                    )
                    return True

    return not field.required


async def _click_radio_option(page: Page, field: FormField, target: str) -> bool:
    """Click a radio option matching target text."""
    try:
        # Strategy 1: Use the fieldset containing this radio button
        parent = await field.element.evaluate_handle(
            "el => el.closest('fieldset') || el.closest('[data-test-form-builder-radio-button-form-component]') || el.parentElement.parentElement"
        )
        el = parent.as_element()
        if el:
            labels = await el.query_selector_all("label")
            # First pass: exact match
            for lbl in labels:
                text = (await lbl.text_content() or "").strip()
                if text.lower() == target.lower():
                    await lbl.click()
                    await asyncio.sleep(0.3)
                    log.info("Selected radio '%s' for '%s'", text, field.label)
                    return True
            # Second pass: partial/contains match
            for lbl in labels:
                text = (await lbl.text_content() or "").strip()
                if target.lower() in text.lower() or text.lower() in target.lower():
                    await lbl.click()
                    await asyncio.sleep(0.3)
                    log.info("Selected radio '%s' (partial) for '%s'", text, field.label)
                    return True

        # Strategy 2: Find radio by value attribute directly
        radios = []
        if el:
            radios = await el.query_selector_all("input[type='radio']")
        for radio in radios:
            radio_id = await radio.get_attribute("id")
            if radio_id:
                lbl = await page.query_selector(f"label[for='{radio_id}']")
                if lbl:
                    text = (await lbl.text_content() or "").strip()
                    if text.lower() == target.lower():
                        await lbl.click()
                        await asyncio.sleep(0.3)
                        log.info("Selected radio '%s' for '%s' (by id)", text, field.label)
                        return True

        # Strategy 3: Try clicking the radio input directly based on value
        for radio in radios:
            val = (await radio.get_attribute("value") or "").strip()
            if val.lower() == target.lower():
                await radio.click(force=True)
                await asyncio.sleep(0.3)
                log.info("Clicked radio value='%s' for '%s'", val, field.label)
                return True

        log.warning("Could not find radio option '%s' for field '%s'", target, field.label)
    except Exception as e:
        log.warning("Error clicking radio option: %s", e)
    return False


async def _fill_checkbox(page: Page, field: FormField, config: HunterConfig) -> bool:
    """Fill a checkbox (typically agreement/acknowledgment or checkbox group)."""
    is_checked = await field.element.is_checked()
    log.info(
        "[FIELD] question=%r type=checkbox input_type=checkbox name=%r id=%r value=%r required=%s",
        field.label, field.name, field.element_id, is_checked, field.required,
    )

    # For labeled checkbox groups (like PRONOUNS), try to match via patterns
    label_lower = field.label.lower()
    if any(kw in label_lower for kw in ["pronoun", "gender", "race", "ethnicit", "veteran", "disabilit"]):
        # Try to find the right checkbox in the group via multi-option matching
        target = match_multi_option(field.label, field.options) if field.options else None
        if not target:
            # Default: "prefer not to answer" type option
            target = "prefer not to answer"

        try:
            parent = await field.element.evaluate_handle(
                "el => el.closest('fieldset') || el.closest('[data-test-form-builder-checkbox-form-component]') || el.parentElement.parentElement.parentElement"
            )
            el = parent.as_element()
            if el:
                labels = await el.query_selector_all("label")
                for lbl in labels:
                    text = (await lbl.text_content() or "").strip()
                    if target.lower() in text.lower() or text.lower() in target.lower():
                        # Check if the associated checkbox is already checked
                        cb = await lbl.query_selector("input[type='checkbox']")
                        if cb:
                            already_checked = await cb.is_checked()
                            if not already_checked:
                                await lbl.click()
                                await asyncio.sleep(0.3)
                                log.info("Checked checkbox '%s' for '%s'", text, field.label)
                        else:
                            await lbl.click()
                            await asyncio.sleep(0.3)
                            log.info("Clicked checkbox label '%s' for '%s'", text, field.label)
                        return True
        except Exception as e:
            log.warning("Error filling checkbox group '%s': %s", field.label, e)

    # Simple required checkbox (agreement/acknowledgment) — just check it
    if not is_checked and field.required:
        await field.element.check()
        log.info("Checked checkbox '%s'", field.label)
    return True


async def _fill_file_upload(field: FormField, config: HunterConfig) -> bool:
    """Upload resume PDF."""
    log.info(
        "[FIELD] question=%r type=file_upload input_type=file name=%r id=%r required=%s",
        field.label, field.name, field.element_id, field.required,
    )
    resume_path = Path(config.profile.resume_path)
    if not resume_path.is_absolute():
        resume_path = get_project_root() / resume_path

    if not resume_path.exists():
        log.warning("Resume file not found: %s", resume_path)
        return False

    await field.element.set_input_files(str(resume_path))
    log.info("Uploaded resume: %s", resume_path.name)
    return True
