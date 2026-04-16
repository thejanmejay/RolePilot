"""Regex-pattern matching for common Easy Apply questions."""

from __future__ import annotations

import re
from typing import Optional

from linkedin_hunter.config import AnswersConfig, ProfileConfig
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


# Built-in patterns mapped to config fields
BUILTIN_PATTERNS: list[tuple[str, str]] = [
    # Work authorization
    (r"(?i)(authorized|legally|eligible).*(work|employ).*(us|u\.s\.|united states)", "authorized_to_work"),
    (r"(?i)(require|need|will you need).*(sponsor|visa|h-?1b)", "sponsorship_required"),
    # Relocation
    (r"(?i)(willing|open|able).*(relocat|move)", "willing_to_relocate"),
    # Salary
    (r"(?i)(salary|compensation|pay).*(expect|desir|require|range)", "desired_salary"),
    (r"(?i)(expected|desired).*(salary|compensation|pay)", "desired_salary"),
    # How did you hear — multi-language
    (r"(?i)how.*(hear|learn|find).*(about|of|this)", "how_did_you_hear"),
    (r"(?i)c[oó]mo.*(enterar|conocer|supiste|enteraste)", "how_did_you_hear"),  # Spanish
    (r"(?i)como.*(ficou sabendo|soube|conheceu)", "how_did_you_hear"),  # Portuguese
    (r"(?i)comment.*(avez|connu|découvert)", "how_did_you_hear"),  # French
    (r"(?i)wie.*(erfahren|gehört|gefunden)", "how_did_you_hear"),  # German
    # Cover letter
    (r"(?i)(cover letter|additional info|tell us more|why.*interest)", "cover_letter"),
    (r"(?i)(carta.*presentaci[oó]n|carta.*motivaci[oó]n)", "cover_letter"),  # Spanish
    (r"(?i)(lettre.*motivation)", "cover_letter"),  # French
]

# Patterns that map to profile fields (multi-language)
PROFILE_PATTERNS: list[tuple[str, str]] = [
    # Name — English, Portuguese, Spanish, French, German, Italian, Dutch, Vietnamese, Korean, Japanese, Chinese
    (r"(?i)(first|given)\s*name", "first_name"),
    (r"(?i)^nome$", "first_name"),  # Portuguese/Italian
    (r"(?i)^(prénom|vorname|nombre|voornaam|tên|이름|名前|名)$", "first_name"),
    (r"(?i)(last|family|sur)\s*name", "last_name"),
    (r"(?i)^sobrenome$", "last_name"),  # Portuguese
    (r"(?i)^(apellido|nom\s*de\s*famille|nachname|achternaam|cognome|họ|성|姓)$", "last_name"),
    (r"(?i)(nombre\s*completo|full\s*name|nome\s*completo)", "first_name"),  # Full name → first_name as fallback
    # Email
    (r"(?i)(email|e-mail|correo|courriel|correio|posta)", "email"),
    # Phone — multi-language
    (r"(?i)(phone|mobile|cell|telephone|telefone|teléfono|téléphone|telefon|telefono|điện thoại|전화|電話)", "phone"),
    (r"(?i)(número.*tel[eé]fono|phone\s*number|mobile\s*number)", "phone"),
    # Address / City — multi-language
    (r"(?i)^(address|endereço|dirección|adresse|indirizzo|adres|địa chỉ|주소|住所)$", "city"),
    (r"(?i)(city|town|cidade|ciudad|ville|stadt|città|thành phố|도시|都市)", "city"),
    (r"(?i)(state|province|estado|provincia|région|bundesland|tỉnh|주|州)", "state"),
    (r"(?i)(country|nation|país|pays|land|paese|quốc gia|국가|国)", "country"),
    # LinkedIn — multi-language
    (r"(?i)(linkedin|profile).*(url|link)", "linkedin_url"),
    (r"(?i)(perfil.*linkedin|linkedin.*perfil)", "linkedin_url"),  # Spanish/Portuguese
    (r"(?i)(profil.*linkedin|linkedin.*profil)", "linkedin_url"),  # French/German
    (r"(?i)^perfil\s*de\s*linkedin$", "linkedin_url"),  # Spanish exact
    (r"(?i)^linkedin\s*profile$", "linkedin_url"),
    (r"(?i)^linkedin\s*url$", "linkedin_url"),
    (r"(?i)^url\s*linkedin$", "linkedin_url"),
    (r"(?i)^linkedin$", "linkedin_url"),  # Just "LinkedIn" as label
    # Website / Portfolio
    (r"(?i)(website|portfolio|personal\s*(url|link|site))", "website"),
    (r"(?i)(sitio\s*web|página\s*web|portafolio)", "website"),  # Spanish
    (r"(?i)(site\s*web|site\s*pessoal|portfólio)", "website"),  # Portuguese
    # Experience — multi-language
    (r"(?i)(years?).*(experience|professional|experiência|experiencia|expérience|erfahrung)", "years_of_experience"),
    (r"(?i)(años|anos|années|jahre).*(experiencia|experiência|expérience|erfahrung)", "years_of_experience"),
]

# Yes/No question detection — answer is tied to config, not hardcoded
# IMPORTANT: Order matters — more specific patterns MUST come before generic ones
YES_NO_PATTERNS: list[tuple[str, str]] = [
    # "Right to work WITHOUT sponsorship" → No (you NEED sponsorship, so you DON'T have the right without it)
    (r"(?i)(right|able|eligible).*(work|employ).*(without|no need).*(sponsor|visa)", "_no"),
    (r"(?i)without.*(need|requirement).*(sponsor|visa)", "_no"),
    (r"(?i)do not offer.*sponsor", "_no"),  # "Please note that we DO NOT offer visa sponsorship"
    (r"(?i)can you.*work.*without.*sponsor", "_no"),
    # Sponsorship required → use config (True = you need it)
    (r"(?i)(require|need).*(sponsor|visa|h-?1b)", "sponsorship_required"),
    (r"(?i)(will you).*(require|need).*(sponsor|visa)", "sponsorship_required"),
    (r"(?i)sponsor.*employment.*visa", "sponsorship_required"),
    # Work authorization — generic "authorized/lawfully work" → use config
    (r"(?i)(authorized|lawfully|legally|eligible).*(work|employ)", "authorized_to_work"),
    # Relocation
    (r"(?i)(willing|open|able).*(relocat|move)", "willing_to_relocate"),
    # Commute / office / hybrid / on-site
    (r"(?i)(comfortable|willing|able).*(commut|travel)", "_yes"),
    (r"(?i)(open|willing|able|okay|ok).*(come|coming|go|going).*(office|on.?site|in.?person)", "_yes"),
    (r"(?i)(open|willing|comfortable).*(hybrid|on.?site|in.?office|in.?person)", "_yes"),
    (r"(?i)(work|come).*(from|to|in).*(office|on.?site)", "_yes"),
    # "Are you ready for this opportunity" / comfortable with X → Yes
    (r"(?i)are you ready", "_yes"),
    (r"(?i)are you.*(comfortable|ok|okay).*(with|working|learning)", "_yes"),
    # Have you read / reviewed / understood job description → Yes
    (r"(?i)(have you|did you).*(read|review|understand|go through).*(job|jd|description|posting|requirement)", "_yes"),
    (r"(?i)read.*(job|jd).*(description|posting|requirement)", "_yes"),
    (r"(?i)(job|jd).*(description|posting).*(read|review|understood|thoroughly)", "_yes"),
    # Specific nationality questions → No
    (r"(?i)are you.*(vietnamese|chinese|korean|japanese|brazilian|american|polish|spanish|german|french|british|canadian|australian|indian)", "_no"),
    # Background check / drug test / screening → Yes
    (r"(?i)(background.*check|drug.*test|screening)", "_yes"),
    # Do you have experience / proficiency → Yes
    (r"(?i)(do you have|are you).*(experience|proficien|familiar|knowledge)", "_yes"),
    # Do you have a valid work permit → use authorized_to_work
    (r"(?i)(have|possess|hold).*(valid|current).*(work\s*permit|visa|authorization)", "authorized_to_work"),
    # Common No answers
    (r"(?i)(do you|have you|are you|will you).*(commit|non-?compete)", "_no"),
    (r"(?i)(been (convicted|charged|arrested))", "_no"),
    (r"(?i)are you.*18.*years.*old", "_yes"),
    (r"(?i)(do you|have you).*driver.*licen", "_yes"),
    # Consent / agree / confirm / acknowledge → Yes
    (r"(?i)(do you|will you).*(agree|consent|acknowledge|confirm)", "_yes"),
    (r"(?i)(confirm|acknowledge|certif).*(above|information|details|true|correct|accurate)", "_yes"),
    # Spanish yes/no questions
    (r"(?i)(tiene|tienes).*(familiar|amigo|conocido|pariente).*(trabaj|empresa|compañía)", "_no"),  # Referral
    (r"(?i)(está|estás).*(dispuesto|disponible).*(reubicar|mudar)", "willing_to_relocate"),  # Relocation
    (r"(?i)(está|estás).*(autorizado|habilitado).*(trabajar)", "authorized_to_work"),  # Work auth
    (r"(?i)(necesita|requiere).*(patrocinio|visa|sponsor)", "sponsorship_required"),  # Sponsorship
    # Portuguese yes/no
    (r"(?i)(você|voce).*(familiar|amigo|conhecido).*(trabalh|empresa)", "_no"),  # Referral
    (r"(?i)(autorizado|habilitado).*(trabalhar)", "authorized_to_work"),
    # French yes/no
    (r"(?i)(connaissez|avez).*(ami|parent|connaissance).*(travail|entreprise)", "_no"),  # Referral
    (r"(?i)(autorisé|habilité).*(travailler)", "authorized_to_work"),
    # German yes/no
    (r"(?i)(kennen|haben).*(freund|verwandter|bekannter).*(arbeit|unternehmen|firma)", "_no"),  # Referral
    (r"(?i)(berechtigt|befugt).*(arbeiten)", "authorized_to_work"),
    # Government / political
    (r"(?i)(government.?official|political|public.?office)", "_no"),
    (r"(?i)(relative|family).*(government|political|public.?office)", "_no"),
]

# Multi-option radio: maps question pattern -> preferred option text to click
# Each entry: (question_regex, [list of preferred option substrings in priority order])
MULTI_OPTION_PATTERNS: list[tuple[str, list[str]]] = [
    # Citizenship / employment eligibility (needs sponsorship)
    (r"(?i)(citizenship|employment\s+eligib)", [
        "Non-citizen seeking work authorization", "Non-citizen allowed to work for any employer",
        "Other",
    ]),
    # Gender — multi-language
    (r"(?i)(gender|género|gênero|genre|geschlecht|genere)", [
        "Male", "male", "Masculino", "masculino", "Homme", "Männlich",
    ]),
    # Disability — multi-language
    (r"(?i)(disabilit|discapacidad|deficiência|handicap|behinderung)", [
        "No, I do not identify", "No", "I don't have a disability",
        "prefer not to answer", "decline", "No, I Don't Have A Disability",
    ]),
    # Veteran — multi-language
    (r"(?i)(veteran|veterano|vétéran)", [
        "No, I do not identify", "No", "not a veteran",
        "I am not a protected veteran", "prefer not to answer",
    ]),
    # Pronouns
    (r"(?i)pronoun", [
        "He/his", "He", "he/him", "He/Him",
    ]),
    # Race / Ethnicity
    (r"(?i)(race|ethnicit|raza|etnia|origine)", [
        "Asian", "asian", "Asian (Not Hispanic or Latino)",
        "South Asian", "Two or More Races", "prefer not to answer",
    ]),
    # Employment contract type / cooperation form
    (r"(?i)(contract.*type|cooperation.*form|employment.*form|type.*contract|form.*employ|tipo.*contrato)", [
        "Employment contract", "Full-time", "Permanent", "open to either", "either",
    ]),
    # Work schedule / shift preference
    (r"(?i)(work.*schedule|shift|hours.*prefer|horario|horaire)", [
        "Full-time", "Regular", "Day shift", "Flexible",
    ]),
    # Experience level
    (r"(?i)(experience.*level|seniority|career.*level|nivel.*experiencia|niveau)", [
        "Mid-Senior", "Senior", "Mid-level", "Experienced",
    ]),
    # Education level
    (r"(?i)(education.*level|highest.*education|education.*attain|nivel.*educaci[oó]n)", [
        "Bachelor's Degree", "Bachelor", "4 year degree", "Undergraduate",
    ]),
    # Work model preference
    (r"(?i)(work.*model|work.*arrangement|preferred.*work.*mode|modalidad)", [
        "Remote", "Hybrid", "Flexible", "Open to all",
    ]),
    # Notice period as multi-option
    (r"(?i)(notice.*period|período.*aviso|pr[eé]avis)", [
        "Immediately", "Less than 2 weeks", "0 days", "Ready to join", "Available immediately",
    ]),
]

# SELECT_OPTION_PATTERNS: for <select> dropdowns specifically, maps question pattern -> preferred option substrings
# These are tried after yes/no and text matching for select fields
SELECT_OPTION_PATTERNS: list[tuple[str, list[str]]] = [
    # Years of experience with any technology (dropdown with "0-1", "1-3", "3-5", "5+")
    (r"(?i)(years?|how many|how much).*(experience|work)", [
        "3-5", "3 - 5", "4", "3+", "4+", "3-5 years",
    ]),
    # Open to office / hybrid / on-site
    (r"(?i)(open|willing|comfortable).*(office|hybrid|on.?site|in.?person)", [
        "Yes", "yes", "Open to either", "Flexible",
    ]),
    # Notice period dropdown
    (r"(?i)(notice.*period|when.*join|when.*start|disponibilidad|availability)", [
        "Immediately", "Less than 2 weeks", "0-15 days", "Within 1 month",
        "0 days", "Available now", "Ready immediately",
    ]),
    # Highest education
    (r"(?i)(highest.*education|education.*level|degree|qualif)", [
        "Bachelor's Degree", "Bachelor", "4 year degree",
    ]),
    # English proficiency
    (r"(?i)(english|language).*(proficien|level|fluenc)", [
        "Professional", "Fluent", "Advanced", "Native or bilingual",
    ]),
    # Work type preference
    (r"(?i)(preferred.*work|work.*prefer|work.*type|tipo.*trabajo)", [
        "Full-time", "Remote", "Full Time",
    ]),
]


def match_multi_option(question_text: str, options: list[str]) -> Optional[str]:
    """For multi-option radio questions, find the best option to select.

    Returns the exact option text to click, or None if no match.
    """
    for pattern, preferred in MULTI_OPTION_PATTERNS:
        if re.search(pattern, question_text):
            # Try each preferred option against actual available options
            for pref in preferred:
                for opt in options:
                    if pref.lower() in opt.lower() or opt.lower() in pref.lower():
                        log.debug("Multi-option match: '%s' -> '%s'", question_text[:50], opt)
                        return opt
            log.debug("Multi-option pattern matched but no option found for: %s", question_text[:50])
            return None
    return None


def match_select_option(question_text: str, options: list[str]) -> Optional[str]:
    """For select dropdown questions, find the best option.

    Returns the exact option text to select, or None if no match.
    """
    for pattern, preferred in SELECT_OPTION_PATTERNS:
        if re.search(pattern, question_text):
            for pref in preferred:
                for opt in options:
                    if pref.lower() in opt.lower() or opt.lower() in pref.lower():
                        log.debug("Select-option match: '%s' -> '%s'", question_text[:50], opt)
                        return opt
            return None
    return None


def match_answer(
    question_text: str,
    answers: AnswersConfig,
    profile: ProfileConfig,
) -> Optional[str]:
    """Try to match a question to an answer using pattern matching.

    Returns the answer string if matched, None otherwise.
    """
    question_text = question_text.strip()
    if not question_text:
        return None

    # 1. Check custom patterns first (user-defined take priority)
    for custom in answers.custom:
        if re.search(custom.pattern, question_text, re.IGNORECASE):
            log.debug("Custom pattern matched: %s -> %s", custom.pattern, custom.answer)
            return custom.answer

    # 2. Check builtin answer patterns
    for pattern, field_name in BUILTIN_PATTERNS:
        if re.search(pattern, question_text):
            value = getattr(answers, field_name, None)
            if value is not None:
                result = _format_answer(value)
                log.debug("Builtin pattern matched: %s -> %s", field_name, result)
                return result

    # 3. Check profile patterns
    for pattern, field_name in PROFILE_PATTERNS:
        if re.search(pattern, question_text):
            value = getattr(profile, field_name, None)
            if value is not None and str(value):
                log.debug("Profile pattern matched: %s -> %s", field_name, value)
                return str(value)

    log.debug("No pattern matched for question: %s", question_text[:80])
    return None


def match_yes_no(question_text: str, answers: AnswersConfig) -> Optional[bool]:
    """For radio/select Yes/No questions, determine the answer.

    Returns True for Yes, False for No, None if no match.
    """
    # Check custom patterns that might resolve to yes/no
    for custom in answers.custom:
        if re.search(custom.pattern, question_text, re.IGNORECASE):
            ans = custom.answer.lower().strip()
            if ans in ("yes", "true"):
                return True
            if ans in ("no", "false"):
                return False
            # Non-boolean answer (like "4", "LinkedIn", "SRM Institute") — skip
            # Don't interpret numeric or text answers as No
            return None

    for pattern, config_field in YES_NO_PATTERNS:
        if re.search(pattern, question_text):
            # Special hardcoded answers
            if config_field == "_yes":
                return True
            if config_field == "_no":
                return False
            # Look up the config field value
            value = getattr(answers, config_field, None)
            if value is not None:
                if isinstance(value, bool):
                    return value
                return str(value).lower() in ("yes", "true", "1")

    return None


def _format_answer(value) -> str:
    """Convert a config value to a string answer."""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value)
