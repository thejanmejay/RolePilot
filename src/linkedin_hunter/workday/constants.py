"""Workday selectors, URL patterns, and constants."""

from __future__ import annotations

import re

# ── URL detection ────────────────────────────────────────────────────
WORKDAY_URL_REGEX = re.compile(
    r"https?://[\w-]+\.wd\d+\.myworkdayjobs\.com/.+"
)

WORKDAY_INTERNAL_REGEX = re.compile(
    r"https?://www\.myworkday\.com/[\w-]+/d/.+"
)


def is_workday_url(url: str) -> bool:
    """Return True if the URL belongs to a Workday career site."""
    return bool(WORKDAY_URL_REGEX.match(url) or WORKDAY_INTERNAL_REGEX.match(url))


def extract_company_from_url(url: str) -> str:
    """Extract the company name from a Workday URL subdomain."""
    m = re.match(r"https?://([\w-]+)\.wd\d+\.myworkdayjobs\.com", url)
    if m:
        return m.group(1)
    m2 = re.match(r"https?://www\.myworkday\.com/([\w-]+)/", url)
    if m2:
        return m2.group(1)
    return "unknown"


# ── Selectors (using data-automation-id where possible) ──────────────

# Page / navigation selectors
PAGE_SELECTORS = {
    # Main content container
    "main_content": "[data-automation-id='compositeContainer'], main[role='main']",
    # Page title / step header
    "page_title": (
        "[data-automation-id='pageHeaderTitle'], "
        "h2[data-automation-id='pageTitle'], "
        "div.css-1hps7xm h2, "
        "h2"
    ),
    # Save & Continue / Next button
    "next_button": (
        "button[data-automation-id='bottom-navigation-next-button'], "
        "button[data-automation-id='nextButton'], "
        "button[aria-label='Save and Continue'], "
        "button[aria-label='Next']"
    ),
    # Submit button
    "submit_button": (
        "button[data-automation-id='bottom-navigation-next-button'], "
        "button[data-automation-id='submitButton'], "
        "button[aria-label='Submit']"
    ),
    # Previous/Back button
    "back_button": (
        "button[data-automation-id='bottom-navigation-previous-button'], "
        "button[aria-label='Previous']"
    ),
    # OK/Confirm button in modals
    "ok_button": "button[data-automation-id='wd-CommandButton_uic_okButton']",
    # Tab navigation
    "tab_labels": "[data-automation-id='tabLabel']",
    # Error messages
    "error_message": (
        "[data-automation-id='errorMessage'], "
        "div[data-automation-id='fieldErrorMessage'], "
        "[aria-live='assertive'][role='alert']"
    ),
}

# Form field selectors
FIELD_SELECTORS = {
    # Text inputs
    "text_input": (
        "input[data-automation-id='textInputBox'], "
        "input[type='text']:not([readonly]), "
        "input[type='email'], "
        "input[type='tel'], "
        "input[type='number'], "
        "input[type='url']"
    ),
    # Textarea
    "textarea": (
        "textarea[data-automation-id='textAreaBox'], "
        "textarea"
    ),
    # Dropdown / combobox (NOT native select — React custom components)
    "dropdown_trigger": (
        "button[data-automation-id='searchButton'], "
        "button[data-automation-id='multiselectInputContainer'], "
        "div[data-automation-id='selectWidget'] button, "
        "div[data-automation-id='multiselectInputContainer'], "
        "input[data-automation-id='searchBox']"
    ),
    # Dropdown search input (inside opened dropdown)
    "dropdown_search": (
        "input[data-automation-id='searchBox'], "
        "input[role='combobox']"
    ),
    # Dropdown option items
    "dropdown_option": (
        "div[data-automation-id='promptOption'], "
        "li[role='option'], "
        "div[role='option']"
    ),
    # Checkbox
    "checkbox": (
        "input[type='checkbox'], "
        "div[data-automation-id='checkboxPanel'] input"
    ),
    # Radio button
    "radio": (
        "input[type='radio'], "
        "div[data-automation-id='radioBtn'] input"
    ),
    # File upload
    "file_upload": (
        "input[type='file'], "
        "button[data-automation-id='file-upload-drop-zone'], "
        "div[data-automation-id='file-upload-drop-zone'] input[type='file']"
    ),
    # Date fields (Workday uses separate m/d/y inputs)
    "date_input": (
        "input[data-automation-id='dateSectionMonth-input'], "
        "input[data-automation-id='dateSectionDay-input'], "
        "input[data-automation-id='dateSectionYear-input']"
    ),
    # Form field container (wrapper around label + input)
    "form_field": (
        "div[data-automation-id='formField'], "
        "[data-automation-id='formField-jobTitle'], "  # example, pattern varies
        "div.css-1wg3kiy"  # common Workday form field wrapper class
    ),
    # Label
    "label": (
        "label[data-automation-id='formLabel'], "
        "label, "
        "div[data-automation-id='formLabel']"
    ),
    # Required marker
    "required_marker": (
        "[data-automation-id='requiredAsterisk'], "
        "abbr[title='required'], "
        "span.required"
    ),
}

# Section detection: maps page step names to keywords
WORKDAY_SECTIONS = {
    "my_information": [
        "my information", "personal information", "contact information",
        "your information", "about you", "applicant information",
    ],
    "my_experience": [
        "my experience", "work experience", "experience", "resume",
        "employment history", "work history",
    ],
    "education": [
        "education", "academic", "qualifications",
    ],
    "application_questions": [
        "application questions", "additional questions", "questions",
        "screening questions", "custom questions",
    ],
    "voluntary_disclosures": [
        "voluntary", "self-identification", "eeo", "equal employment",
        "demographic", "disclosures",
    ],
    "review": [
        "review", "summary", "confirm", "submit",
    ],
}

# Common Workday form field automation IDs (exact matches)
KNOWN_FIELD_IDS = {
    # My Information page
    "legalNameSection_firstName": "first_name",
    "legalNameSection_lastName": "last_name",
    "addressSection_addressLine1": "address",
    "addressSection_city": "city",
    "addressSection_region": "state",
    "addressSection_postalCode": "zip_code",
    "addressSection_countryRegion": "country",
    "phone-device-type": "phone_type",
    "phone-number": "phone",
    "email": "email",
    "linkedInProfile": "linkedin_url",
    "source": "how_did_you_hear",
    # My Experience page
    "jobTitle": "job_title",
    "company": "company_name",
    "startDate": "start_date",
    "endDate": "end_date",
    "description": "description",
    "school": "school_name",
    "degree": "degree",
    "fieldOfStudy": "field_of_study",
    "gpa": "gpa",
    # Application Questions
    "currentlyEmployed": "currently_employed",
    "yearsOfExperience": "years_of_experience",
    "referredBy": "referred_by",
}

# Human-like delays (seconds)
WORKDAY_DELAYS = {
    "between_fields": (0.5, 1.5),
    "between_pages": (2.0, 5.0),
    "after_dropdown_open": (0.5, 1.0),
    "after_dropdown_select": (0.3, 0.8),
    "typing_delay_ms": (30, 80),  # per character
    "before_submit": (3.0, 6.0),
}
