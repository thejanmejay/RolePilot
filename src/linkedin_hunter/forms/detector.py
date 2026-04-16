"""Detect form field types in LinkedIn Easy Apply modal."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from playwright.async_api import Page, ElementHandle

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


class FieldType(Enum):
    TEXT = "text"
    TEXTAREA = "textarea"
    SELECT = "select"
    RADIO = "radio"
    CHECKBOX = "checkbox"
    FILE_UPLOAD = "file_upload"
    UNKNOWN = "unknown"


@dataclass
class FormField:
    field_type: FieldType
    label: str
    element: ElementHandle
    required: bool = False
    options: list[str] = None  # type: ignore[assignment]
    current_value: str = ""

    def __post_init__(self):
        if self.options is None:
            self.options = []


# Selectors for Easy Apply modal form elements
MODAL_SELECTORS = {
    "modal": "div.jobs-easy-apply-modal, div[data-test-modal]",
    "form_groups": "div.fb-dash-form-element, div.jobs-easy-apply-form-section__grouping",
    "label": "label, span.fb-dash-form-element__label, span.t-14.t-bold",
    "text_input": "input[type='text'], input[type='email'], input[type='tel'], input[type='number'], input[type='url']",
    "textarea": "textarea",
    "select": "select",
    "radio_group": "fieldset input[type='radio']",
    "checkbox": "input[type='checkbox']",
    "file_upload": "input[type='file']",
    "required_marker": "span.fb-dash-form-element__label-title--is-required, span[aria-hidden='true']",
}


async def detect_form_fields(page: Page) -> list[FormField]:
    """Detect all form fields in the currently visible Easy Apply modal step."""
    fields: list[FormField] = []

    # Find all form groups in the modal
    groups = await page.query_selector_all(MODAL_SELECTORS["form_groups"])
    log.info("Detected %d form groups in modal", len(groups))

    for group in groups:
        try:
            field = await _classify_group(group)
            if field:
                fields.append(field)
        except Exception as e:
            log.warning("Error detecting field: %s", e)

    # Also look for standalone file uploads
    file_inputs = await page.query_selector_all(MODAL_SELECTORS["file_upload"])
    existing_uploads = any(f.field_type == FieldType.FILE_UPLOAD for f in fields)
    if file_inputs and not existing_uploads:
        for fi in file_inputs:
            fields.append(FormField(
                field_type=FieldType.FILE_UPLOAD,
                label="Resume",
                element=fi,
            ))

    log.info("Detected %d form fields total", len(fields))
    return fields


async def _get_label(group: ElementHandle) -> str:
    """Extract the label text from a form group."""
    for selector in ["label", "span.fb-dash-form-element__label", "span.t-14.t-bold", "legend"]:
        label_el = await group.query_selector(selector)
        if label_el:
            # Prefer the aria-hidden span (visible text) to avoid duplication
            visible_span = await label_el.query_selector("span[aria-hidden='true']")
            if visible_span:
                text = await visible_span.text_content()
                if text and text.strip():
                    return text.strip()
            text = await label_el.text_content()
            if text and text.strip():
                cleaned = _deduplicate_label(text.strip())
                return cleaned
    return ""


def _deduplicate_label(text: str) -> str:
    """Fix duplicated labels like 'Email addressEmail address' -> 'Email address'."""
    text = text.strip()
    length = len(text)
    if length >= 4 and length % 2 == 0:
        half = length // 2
        if text[:half] == text[half:]:
            return text[:half]
    # Also try with whitespace variations
    # e.g. "City City" or "Phone country code Phone country code"
    words = text.split()
    if len(words) >= 2 and len(words) % 2 == 0:
        half = len(words) // 2
        if words[:half] == words[half:]:
            return " ".join(words[:half])
    return text


async def _is_required(group: ElementHandle) -> bool:
    """Check if the field is required."""
    required_el = await group.query_selector(MODAL_SELECTORS["required_marker"])
    if required_el:
        text = await required_el.text_content()
        if text and "*" in text:
            return True
    # Also check for required attribute on inputs
    inp = await group.query_selector("input, select, textarea")
    if inp:
        req = await inp.get_attribute("required")
        aria_req = await inp.get_attribute("aria-required")
        if req is not None or aria_req == "true":
            return True
    return False


async def _classify_group(group: ElementHandle) -> Optional[FormField]:
    """Classify a form group into a field type."""
    label = await _get_label(group)
    required = await _is_required(group)

    # Check for select dropdown
    select_el = await group.query_selector(MODAL_SELECTORS["select"])
    if select_el:
        options = []
        opt_els = await select_el.query_selector_all("option")
        for opt in opt_els:
            text = await opt.text_content()
            if text and text.strip() and text.strip() != "Select an option":
                options.append(text.strip())
        return FormField(
            field_type=FieldType.SELECT,
            label=label,
            element=select_el,
            required=required,
            options=options,
        )

    # Check for radio buttons
    radios = await group.query_selector_all("input[type='radio']")
    if radios:
        options = []
        for radio in radios:
            # Get the label for each radio
            radio_id = await radio.get_attribute("id")
            if radio_id:
                radio_label = await group.query_selector(f"label[for='{radio_id}']")
                if radio_label:
                    text = await radio_label.text_content()
                    if text:
                        options.append(text.strip())
        # For radio groups, get the question text from legend or fieldset label
        radio_label = label
        fieldset = await group.query_selector("fieldset")
        if fieldset:
            legend = await fieldset.query_selector("legend, span.fb-dash-form-element__label")
            if legend:
                legend_text = (await legend.text_content() or "").strip()
                if legend_text and len(legend_text) > len(radio_label):
                    radio_label = legend_text
        # Also try getting question from the group's direct text content
        if not radio_label or len(radio_label) < 10:
            group_text = (await group.text_content() or "").strip()
            # Remove option texts from group text to get the question
            for opt in options:
                group_text = group_text.replace(opt, "")
            group_text = group_text.strip()
            if group_text and len(group_text) > len(radio_label):
                radio_label = group_text
        log.info("Radio group detected: question='%s', options=%s", radio_label[:80], options)
        return FormField(
            field_type=FieldType.RADIO,
            label=radio_label,
            element=radios[0],
            required=required,
            options=options,
        )

    # Check for checkbox
    checkbox = await group.query_selector(MODAL_SELECTORS["checkbox"])
    if checkbox:
        return FormField(
            field_type=FieldType.CHECKBOX,
            label=label,
            element=checkbox,
            required=required,
        )

    # Check for textarea
    textarea = await group.query_selector(MODAL_SELECTORS["textarea"])
    if textarea:
        val = (await textarea.input_value()) or ""
        return FormField(
            field_type=FieldType.TEXTAREA,
            label=label,
            element=textarea,
            required=required,
            current_value=val,
        )

    # Check for text input
    text_input = await group.query_selector(MODAL_SELECTORS["text_input"])
    if text_input:
        val = (await text_input.input_value()) or ""
        return FormField(
            field_type=FieldType.TEXT,
            label=label,
            element=text_input,
            required=required,
            current_value=val,
        )

    # Check for file upload
    file_input = await group.query_selector(MODAL_SELECTORS["file_upload"])
    if file_input:
        return FormField(
            field_type=FieldType.FILE_UPLOAD,
            label=label,
            element=file_input,
            required=required,
        )

    return None
