"""Workday page and form field detection.

Detects which step of the Workday application flow the user is on,
and discovers all fillable form fields on the current page.
Handles Workday's React-based custom components.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from playwright.async_api import Page, ElementHandle

from linkedin_hunter.utils.logging import get_logger
from linkedin_hunter.workday.constants import (
    PAGE_SELECTORS, FIELD_SELECTORS, WORKDAY_SECTIONS, KNOWN_FIELD_IDS,
)

log = get_logger(__name__)


class WorkdayPage(Enum):
    """Steps in a Workday application wizard."""
    MY_INFORMATION = "my_information"
    MY_EXPERIENCE = "my_experience"
    EDUCATION = "education"
    APPLICATION_QUESTIONS = "application_questions"
    VOLUNTARY_DISCLOSURES = "voluntary_disclosures"
    REVIEW = "review"
    UNKNOWN = "unknown"


class WDFieldType(Enum):
    """Workday-specific field types."""
    TEXT = "text"
    TEXTAREA = "textarea"
    DROPDOWN = "dropdown"         # React combobox (NOT native select)
    NATIVE_SELECT = "native_select"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    FILE_UPLOAD = "file_upload"
    DATE = "date"
    UNKNOWN = "unknown"


@dataclass
class WDFormField:
    """A detected Workday form field."""
    field_type: WDFieldType
    label: str
    element: ElementHandle
    required: bool = False
    options: list[str] = field(default_factory=list)
    current_value: str = ""
    automation_id: str = ""       # data-automation-id if available
    config_key: str = ""          # mapped config key (e.g., "first_name")


async def detect_current_page(page: Page) -> WorkdayPage:
    """Detect which step of the Workday application we're on."""
    try:
        # Try to get the page title/header text
        title_el = await page.query_selector(PAGE_SELECTORS["page_title"])
        if title_el:
            title_text = ((await title_el.text_content()) or "").strip().lower()
            log.info("Workday page title: '%s'", title_text)

            for section, keywords in WORKDAY_SECTIONS.items():
                for kw in keywords:
                    if kw in title_text:
                        result = WorkdayPage(section)
                        log.info("Detected Workday page: %s", result.value)
                        return result

        # Fallback: check page content for section indicators
        body_text = ((await page.text_content("body")) or "").lower()

        # Check for review page (has Submit button)
        submit_btn = await page.query_selector(
            "button[aria-label='Submit'], button:has-text('Submit')"
        )
        if submit_btn:
            btn_text = ((await submit_btn.text_content()) or "").strip().lower()
            if "submit" in btn_text:
                return WorkdayPage.REVIEW

        # Check for file upload (likely My Experience page)
        file_input = await page.query_selector(FIELD_SELECTORS["file_upload"])
        if file_input:
            return WorkdayPage.MY_EXPERIENCE

        # Check for voluntary disclosure keywords
        if any(kw in body_text for kw in ["voluntary", "self-identification", "eeo"]):
            return WorkdayPage.VOLUNTARY_DISCLOSURES

    except Exception as e:
        log.warning("Error detecting Workday page: %s", e)

    return WorkdayPage.UNKNOWN


async def detect_workday_fields(page: Page) -> list[WDFormField]:
    """Detect all fillable form fields on the current Workday page."""
    fields: list[WDFormField] = []

    # Strategy 1: Find fields by data-automation-id containers
    auto_id_fields = await _find_fields_by_automation_id(page)
    fields.extend(auto_id_fields)

    # Strategy 2: Find fields by generic form structure
    generic_fields = await _find_generic_fields(page)

    # Deduplicate: don't add generic fields that overlap with automation_id ones
    existing_elements = set()
    for f in fields:
        try:
            bbox = await f.element.bounding_box()
            if bbox:
                existing_elements.add((int(bbox["x"]), int(bbox["y"])))
        except Exception:
            pass

    for f in generic_fields:
        try:
            bbox = await f.element.bounding_box()
            if bbox:
                pos = (int(bbox["x"]), int(bbox["y"]))
                if pos not in existing_elements:
                    fields.append(f)
                    existing_elements.add(pos)
        except Exception:
            fields.append(f)

    # Strategy 3: Find standalone file uploads
    if not any(f.field_type == WDFieldType.FILE_UPLOAD for f in fields):
        file_fields = await _find_file_uploads(page)
        fields.extend(file_fields)

    log.info("Detected %d Workday form fields", len(fields))
    for f in fields:
        log.debug("  - %s: '%s' (required=%s, auto_id=%s)", f.field_type.value, f.label[:50], f.required, f.automation_id)

    return fields


async def _find_fields_by_automation_id(page: Page) -> list[WDFormField]:
    """Find form fields using data-automation-id attributes."""
    fields: list[WDFormField] = []

    # Find all elements with data-automation-id that contain form fields
    containers = await page.query_selector_all("[data-automation-id]")

    for container in containers:
        try:
            auto_id = (await container.get_attribute("data-automation-id")) or ""

            # Skip non-form elements
            if not auto_id or auto_id in ("page", "compositeContainer", "tabLabel"):
                continue

            # Check if this contains an input
            field = await _classify_automation_container(container, auto_id)
            if field:
                fields.append(field)

        except Exception as e:
            log.debug("Error processing automation-id element: %s", e)

    return fields


async def _classify_automation_container(container: ElementHandle, auto_id: str) -> Optional[WDFormField]:
    """Classify a data-automation-id container into a form field."""

    # Check for text input
    text_input = await container.query_selector("input[type='text'], input[type='email'], input[type='tel'], input[type='number'], input[type='url']")
    if text_input:
        label = await _get_label_for_element(container)
        val = (await text_input.input_value()) or ""
        required = await _check_required(container)
        config_key = KNOWN_FIELD_IDS.get(auto_id, "")
        return WDFormField(
            field_type=WDFieldType.TEXT,
            label=label,
            element=text_input,
            required=required,
            current_value=val,
            automation_id=auto_id,
            config_key=config_key,
        )

    # Check for textarea
    textarea = await container.query_selector("textarea")
    if textarea:
        label = await _get_label_for_element(container)
        val = (await textarea.input_value()) or ""
        required = await _check_required(container)
        return WDFormField(
            field_type=WDFieldType.TEXTAREA,
            label=label,
            element=textarea,
            required=required,
            current_value=val,
            automation_id=auto_id,
        )

    # Check for dropdown/combobox (React custom component)
    dropdown_btn = await container.query_selector(
        "button[aria-haspopup='listbox'], "
        "div[role='combobox'], "
        "input[role='combobox'], "
        "[data-automation-id='searchButton']"
    )
    if dropdown_btn:
        label = await _get_label_for_element(container)
        required = await _check_required(container)
        current = await _get_dropdown_current_value(container)
        return WDFormField(
            field_type=WDFieldType.DROPDOWN,
            label=label,
            element=dropdown_btn,
            required=required,
            current_value=current,
            automation_id=auto_id,
            config_key=KNOWN_FIELD_IDS.get(auto_id, ""),
        )

    # Check for native select
    select = await container.query_selector("select")
    if select:
        label = await _get_label_for_element(container)
        options = await _get_select_options(select)
        required = await _check_required(container)
        return WDFormField(
            field_type=WDFieldType.NATIVE_SELECT,
            label=label,
            element=select,
            required=required,
            options=options,
            automation_id=auto_id,
        )

    # Check for checkbox
    checkbox = await container.query_selector("input[type='checkbox']")
    if checkbox:
        label = await _get_label_for_element(container)
        is_checked = await checkbox.is_checked()
        return WDFormField(
            field_type=WDFieldType.CHECKBOX,
            label=label,
            element=checkbox,
            required=await _check_required(container),
            current_value="true" if is_checked else "",
            automation_id=auto_id,
        )

    # Check for radio
    radio = await container.query_selector("input[type='radio']")
    if radio:
        label = await _get_label_for_element(container)
        options = await _get_radio_options(container)
        return WDFormField(
            field_type=WDFieldType.RADIO,
            label=label,
            element=radio,
            required=await _check_required(container),
            options=options,
            automation_id=auto_id,
        )

    # Check for file upload
    file_input = await container.query_selector("input[type='file']")
    if file_input:
        label = await _get_label_for_element(container)
        return WDFormField(
            field_type=WDFieldType.FILE_UPLOAD,
            label=label or "Resume",
            element=file_input,
            automation_id=auto_id,
        )

    return None


async def _find_generic_fields(page: Page) -> list[WDFormField]:
    """Find fields using generic CSS selectors when automation IDs aren't available."""
    fields: list[WDFormField] = []

    # Text inputs not yet captured
    text_inputs = await page.query_selector_all(
        "input[type='text']:not([readonly]):not([data-automation-id]), "
        "input[type='email']:not([data-automation-id]), "
        "input[type='tel']:not([data-automation-id]), "
        "input[type='number']:not([data-automation-id])"
    )
    for inp in text_inputs:
        try:
            # Skip hidden inputs
            if not await inp.is_visible():
                continue
            label = await _get_label_for_input(page, inp)
            val = (await inp.input_value()) or ""
            fields.append(WDFormField(
                field_type=WDFieldType.TEXT,
                label=label,
                element=inp,
                required=await _is_input_required(inp),
                current_value=val,
            ))
        except Exception:
            pass

    # Textareas
    textareas = await page.query_selector_all("textarea:not([data-automation-id])")
    for ta in textareas:
        try:
            if not await ta.is_visible():
                continue
            label = await _get_label_for_input(page, ta)
            val = (await ta.input_value()) or ""
            fields.append(WDFormField(
                field_type=WDFieldType.TEXTAREA,
                label=label,
                element=ta,
                required=await _is_input_required(ta),
                current_value=val,
            ))
        except Exception:
            pass

    return fields


async def _find_file_uploads(page: Page) -> list[WDFormField]:
    """Find file upload fields."""
    fields: list[WDFormField] = []
    file_inputs = await page.query_selector_all("input[type='file']")
    for fi in file_inputs:
        fields.append(WDFormField(
            field_type=WDFieldType.FILE_UPLOAD,
            label="Resume",
            element=fi,
        ))
    return fields


async def _get_label_for_element(container: ElementHandle) -> str:
    """Extract label text from a form field container."""
    for selector in [
        "label",
        "[data-automation-id='formLabel']",
        "legend",
        "span.css-1wc7gxo",  # common Workday label class
    ]:
        label_el = await container.query_selector(selector)
        if label_el:
            text = (await label_el.text_content() or "").strip()
            if text:
                # Remove required asterisk
                text = re.sub(r"\s*\*\s*$", "", text).strip()
                return text
    return ""


async def _get_label_for_input(page: Page, inp: ElementHandle) -> str:
    """Get label for an input by id→for association or parent traversal."""
    inp_id = await inp.get_attribute("id")
    if inp_id:
        label = await page.query_selector(f"label[for='{inp_id}']")
        if label:
            text = (await label.text_content() or "").strip()
            if text:
                return re.sub(r"\s*\*\s*$", "", text).strip()

    # Try aria-label
    aria = await inp.get_attribute("aria-label")
    if aria:
        return aria.strip()

    # Try placeholder
    placeholder = await inp.get_attribute("placeholder")
    if placeholder:
        return placeholder.strip()

    return ""


async def _check_required(container: ElementHandle) -> bool:
    """Check if a field container indicates required."""
    # Check for required asterisk
    req = await container.query_selector(
        "[data-automation-id='requiredAsterisk'], abbr[title='required'], span.required"
    )
    if req:
        return True
    # Check input's required/aria-required attributes
    inp = await container.query_selector("input, select, textarea")
    if inp:
        if await inp.get_attribute("required") is not None:
            return True
        if await inp.get_attribute("aria-required") == "true":
            return True
    return False


async def _is_input_required(inp: ElementHandle) -> bool:
    """Check if an individual input is required."""
    if await inp.get_attribute("required") is not None:
        return True
    return await inp.get_attribute("aria-required") == "true"


async def _get_dropdown_current_value(container: ElementHandle) -> str:
    """Get the current selection text from a Workday dropdown."""
    try:
        # The selected value is often in a pill/chip or display text
        for sel in [
            "[data-automation-id='selectedItem']",
            "div[data-automation-id='promptValue']",
            ".css-1uccc91-singleValue",  # React Select
            "span.css-truncate",
        ]:
            val_el = await container.query_selector(sel)
            if val_el:
                text = (await val_el.text_content() or "").strip()
                if text:
                    return text
    except Exception:
        pass
    return ""


async def _get_select_options(select: ElementHandle) -> list[str]:
    """Get all options from a native select element."""
    options = []
    opt_els = await select.query_selector_all("option")
    for opt in opt_els:
        text = (await opt.text_content() or "").strip()
        value = (await opt.get_attribute("value")) or ""
        if text and text.lower() not in ("select", "select an option", "--", ""):
            options.append(text)
    return options


async def _get_radio_options(container: ElementHandle) -> list[str]:
    """Get all radio option labels from a container."""
    options = []
    radios = await container.query_selector_all("input[type='radio']")
    for radio in radios:
        radio_id = await radio.get_attribute("id")
        if radio_id:
            label = await container.query_selector(f"label[for='{radio_id}']")
            if label:
                text = (await label.text_content() or "").strip()
                if text:
                    options.append(text)
    if not options:
        # Fallback: get all label texts in the container
        labels = await container.query_selector_all("label")
        for lbl in labels:
            text = (await lbl.text_content() or "").strip()
            if text:
                options.append(text)
    return options
