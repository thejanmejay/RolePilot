"""Unit tests for form filling, salary matching, select safety, ratings, and CLI limits."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from linkedin_hunter.config import HunterConfig, load_config
from linkedin_hunter.forms.detector import FieldType, FormField
from linkedin_hunter.forms.filler import _get_numeric_answer, _fill_select, fill_form_fields, _extract_from_resume
from linkedin_hunter.forms.questions import match_answer, match_yes_no


def test_notice_period_is_configured_and_not_zero():
    """Notice period questions should return profile notice_period_days (30), never '0'."""
    cfg = load_config()
    assert _get_numeric_answer("Please enter your notice period in days", cfg) == "30"
    assert _get_numeric_answer("How many days is your notice period?", cfg) == "30"
    assert _get_numeric_answer("Number of days available to join", cfg) == "30"
    assert match_answer("Please enter your notice period in days", cfg.answers, cfg.profile) == "30"
    assert match_answer("What is your current notice period?", cfg.answers, cfg.profile) == "30"


def test_rating_out_of_5_never_returns_7():
    """Rating out of 5 must return <= 5, never 7."""
    cfg = HunterConfig()
    ans = _get_numeric_answer("Rate your English speaking skills out of 5.", cfg)
    assert ans == "5"
    assert int(ans) <= 5

    ans2 = _get_numeric_answer("Rate your understanding and expertise in E2E Testing & Regression Testing out of 5.", cfg)
    assert ans2 == "5"
    assert int(ans2) <= 5


def test_rating_out_of_10_returns_10():
    """Rating out of 10 should return 10."""
    cfg = HunterConfig()
    ans = _get_numeric_answer("Rate your Python skills on a scale of 1 to 10.", cfg)
    assert ans == "10"


def test_bachelors_degree_yes_no_matches_yes():
    """Bachelor's degree completion questions must match Yes and not return university name."""
    cfg = load_config()
    question = "Have you completed the following level of education: Bachelor's Degree?"

    # 1. match_yes_no should match True
    assert match_yes_no(question, cfg.answers) is True

    # 2. match_answer should return "Yes"
    assert match_answer(question, cfg.answers, cfg.profile) == "Yes"

    # 3. _extract_from_resume should NOT return university name for degree questions
    resume_text = "Education: Bachelor of Technology from Mangalmay Institute of Technology (2020-2024)"
    assert _extract_from_resume(question, resume_text) is None


def test_qa_and_location_question_matching():
    """QA tools, API testing, product company, and Delhi/NCR location questions should match Yes from config."""
    cfg = load_config()
    assert match_answer("Do you have hands-on experience with API testing?", cfg.answers, cfg.profile) == "Yes"
    assert match_answer("Do you have experience in Quality Assurance and its tools?", cfg.answers, cfg.profile) == "Yes"
    assert match_answer("Are you currently based out of Delhi/NCR?", cfg.answers, cfg.profile) == "Yes"
    assert match_answer("Are you presently associated with a product-based company?", cfg.answers, cfg.profile) == "Yes"


def test_build_search_url_multi_experience_level():
    """filters.build_search_url should correctly parse comma-separated experience levels into f_E=2,3."""
    from linkedin_hunter.jobs.filters import build_search_url
    cfg = load_config()
    cfg.search.experience_level = "entry,associate"
    url = build_search_url(cfg.search)
    assert "f_E=2%2C3" in url or "f_E=2,3" in url


def test_commute_question_does_not_default_yes():
    """Subjective commute questions must not be blindly auto-answered as Yes."""
    cfg = load_config()
    q = "Are you comfortable commuting to this job's location?"
    assert match_yes_no(q, cfg.answers) is None


def test_salary_matching_lpa_vs_inr():
    """Salary matching should distinguish LPA from INR/CTC and avoid in-hand matching."""
    cfg = load_config()

    # 1. Current CTC in INR
    assert match_answer("Please enter your current ctc in INR", cfg.answers, cfg.profile) == "378000"
    assert match_answer("What is your current CTC?", cfg.answers, cfg.profile) == "378000"

    # 2. Current CTC in LPA
    assert match_answer("What's your current salary? (in lakhs per annum)", cfg.answers, cfg.profile) == "3.78"
    assert match_answer("Current CTC in LPA", cfg.answers, cfg.profile) == "3.78"

    # 3. Expected CTC in INR
    assert match_answer("Please enter your expected ctc in INR", cfg.answers, cfg.profile) == "550000"
    assert match_answer("What is your expected CTC?", cfg.answers, cfg.profile) == "550000"

    # 4. Expected CTC in LPA
    assert match_answer("Expected salary in LPA", cfg.answers, cfg.profile) == "5.5"
    assert match_answer("What is your expected CTC in Lakhs per annum?", cfg.answers, cfg.profile) == "5.5"

    # 5. In-hand salary should NOT be automatically answered
    assert match_answer("What is your current in-hand salary ?", cfg.answers, cfg.profile) is None
    assert match_answer("What is your expected in-hand salary ?", cfg.answers, cfg.profile) is None


@pytest.mark.asyncio
async def test_unknown_required_select_does_not_select_first_option(monkeypatch):
    """Unknown required select dropdown should return False on timeout, never pick options[0]."""
    page = MagicMock()
    mock_element = MagicMock()
    mock_element.select_option = AsyncMock()

    field = FormField(
        field_type=FieldType.SELECT,
        label="Please select your total additional months of experience:",
        element=mock_element,
        required=True,
        options=["0 month", "1 month", "2 months", "3 months", "4 months"],
    )

    cfg = HunterConfig()

    async def mock_prompt(*args, **kwargs):
        return None

    monkeypatch.setattr("linkedin_hunter.forms.filler.prompt_user_for_input", mock_prompt)

    success = await _fill_select(page, field, cfg)
    assert success is False
    mock_element.select_option.assert_not_called()


@pytest.mark.asyncio
async def test_fill_form_fields_tracks_required_failed(monkeypatch):
    """fill_form_fields should report required_failed=True when a required field cannot be filled."""
    page = MagicMock()
    mock_element = MagicMock()

    field = FormField(
        field_type=FieldType.SELECT,
        label="Do you have experience in heavy fabrication ?",
        element=mock_element,
        required=True,
        options=["Yes", "No"],
    )

    cfg = HunterConfig()

    async def mock_prompt(*args, **kwargs):
        return None

    monkeypatch.setattr("linkedin_hunter.forms.filler.prompt_user_for_input", mock_prompt)

    filled, skipped, req_failed = await fill_form_fields(page, [field], cfg)
    assert filled == 0
    assert skipped == 1
    assert req_failed is True


def test_senior_and_lead_titles_are_blacklisted():
    """Senior and Lead roles should be included in blacklist_title."""
    cfg = load_config()
    blacklist = [t.lower() for t in cfg.apply.blacklist_title]

    titles_to_block = [
        "Senior Data Quality Engineer",
        "Lead Automation Engineer",
        "Senior AI QA Automation Engineer",
        "Staff QA Engineer",
        "Engineering Manager",
    ]

    for title in titles_to_block:
        assert any(b in title.lower() for b in blacklist), f"Title '{title}' should be blacklisted"


def test_cli_limit_inherits_config(monkeypatch):
    """CLI limit defaults to cfg.apply.limit when option is not provided."""
    from linkedin_hunter.cli import apply
    import click

    cfg = load_config()
    passed_limit = []

    async def mock_run_apply(config, limit, dry_run=False):
        passed_limit.append(limit)

    monkeypatch.setattr("linkedin_hunter.jobs.apply.run_apply", mock_run_apply)

    ctx = click.Context(apply, obj={"config": cfg})
    ctx.invoke(apply, limit=None, dry_run=True, keywords=None, location=None, freshness=None, all_jobs=False)

    assert passed_limit == [cfg.apply.limit]


def test_browser_engine_close_resilient():
    """BrowserEngine.close should be resilient and not throw uncaught exceptions."""
    from linkedin_hunter.browser.engine import BrowserEngine

    cfg = HunterConfig()
    engine = BrowserEngine(cfg)

    mock_page = MagicMock()
    mock_page.is_closed.return_value = False
    mock_page.close = AsyncMock(side_effect=RuntimeError("Event loop is closed"))
    engine._page = mock_page

    mock_playwright = MagicMock()
    mock_playwright.stop = AsyncMock(side_effect=Exception("Playwright already stopped"))
    engine._playwright = mock_playwright

    asyncio.run(engine.close())
    assert engine._page is None
    assert engine._playwright is None


def test_strict_option_matching():
    """Malformed answers like 'Yyes' or 'Nno' must NOT match Yes/No options."""
    from linkedin_hunter.forms.filler import match_option_to_choices

    opts = ["Yes", "No"]
    # Rejections
    assert match_option_to_choices("Yyes", opts) is None
    assert match_option_to_choices("Nno", opts) is None
    assert match_option_to_choices("yesss", opts) is None
    assert match_option_to_choices("noooo", opts) is None
    assert match_option_to_choices("maybe", opts) is None

    # Valid matches
    assert match_option_to_choices("Yes", opts) == "Yes"
    assert match_option_to_choices("yes", opts) == "Yes"
    assert match_option_to_choices("y", opts) == "Yes"
    assert match_option_to_choices("No", opts) == "No"
    assert match_option_to_choices("no", opts) == "No"
    assert match_option_to_choices("n", opts) == "No"

    # Multi-options
    multi = ["High School", "Bachelor's Degree", "Master's Degree"]
    assert match_option_to_choices("Bachelor's Degree", multi) == "Bachelor's Degree"
    assert match_option_to_choices("bachelor's degree", multi) == "Bachelor's Degree"
    assert match_option_to_choices("2", multi) == "Bachelor's Degree"


def test_user_memory_persistence_rules(tmp_path):
    """Ephemeral, date-specific, location-specific, or interview questions must not persist."""
    from linkedin_hunter.forms.memory import should_persist_question, UserMemory

    # Ephemeral / dynamic questions
    assert not should_persist_question("Are you available for an in person interview for the week of 5th, 6th, and 7th October 2026?")
    assert not should_persist_question("Are you currently in Bangalore?")
    assert not should_persist_question("Are you an immediate joiner?")
    assert not should_persist_question("Mention your official LWD in DDMMYY format")
    assert not should_persist_question("Can you start immediately?")
    assert not should_persist_question("Comfortable with night shifts?")
    assert not should_persist_question("Willing to relocate?")

    # Stable facts
    assert should_persist_question("What is your highest level of education completed?")
    assert should_persist_question("How many years of experience do you have with Playwright?")

    # Verify UserMemory does not store dynamic questions
    mem_file = tmp_path / "memory.yaml"
    mem = UserMemory(memory_path=mem_file)
    mem.store("Are you currently in Bangalore?", "Yes")
    assert mem.lookup("Are you currently in Bangalore?") is None
    assert len(mem.get_all()) == 0

    # Verify UserMemory stores stable facts
    mem.store("Years of experience with Selenium?", "2")
    assert mem.lookup("Years of experience with Selenium?") == "2"
    assert len(mem.get_all()) == 1


def test_already_applied_detection():
    """_is_already_applied_on_page should detect LinkedIn 'Applied' status indicators."""
    from linkedin_hunter.jobs.apply import _is_already_applied_on_page

    mock_page = MagicMock()

    # Case 1: Feedback message shows 'Applied 43m ago'
    mock_el = MagicMock()
    mock_el.text_content = AsyncMock(return_value="Applied 43m ago")
    mock_page.query_selector_all = AsyncMock(return_value=[mock_el])

    assert asyncio.run(_is_already_applied_on_page(mock_page)) is True

    # Case 2: Regular 'Easy Apply' button is present (not applied)
    mock_el_ea = MagicMock()
    mock_el_ea.text_content = AsyncMock(return_value="Easy Apply")
    mock_page.query_selector_all = AsyncMock(return_value=[mock_el_ea])

    assert asyncio.run(_is_already_applied_on_page(mock_page)) is False


def test_collect_search_jobs_deduplication(monkeypatch):
    """collect_search_jobs should deduplicate cards by linkedin_id and respect target_count."""
    from linkedin_hunter.jobs.parser import JobCard
    from linkedin_hunter.jobs.search import collect_search_jobs

    cfg = HunterConfig()
    cfg.search.max_jobs = 5

    # Page 1 returns cards 1, 2, 3
    p1_cards = [
        JobCard(linkedin_id="101", title="QA Engineer", company="Co A"),
        JobCard(linkedin_id="102", title="SDET", company="Co B"),
        JobCard(linkedin_id="103", title="Test Engineer", company="Co C"),
    ]
    # Page 2 returns duplicate 102, 103, and new 104, 105, 106
    p2_cards = [
        JobCard(linkedin_id="102", title="SDET", company="Co B"),
        JobCard(linkedin_id="103", title="Test Engineer", company="Co C"),
        JobCard(linkedin_id="104", title="QA Automation", company="Co D"),
        JobCard(linkedin_id="105", title="Quality Engineer", company="Co E"),
        JobCard(linkedin_id="106", title="Test Lead", company="Co F"),
    ]

    call_count = 0

    async def mock_parse_job_cards(page):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return p1_cards
        return p2_cards

    monkeypatch.setattr("linkedin_hunter.jobs.search.parse_job_cards", mock_parse_job_cards)
    monkeypatch.setattr("linkedin_hunter.jobs.search.human_delay", AsyncMock())
    monkeypatch.setattr("linkedin_hunter.jobs.search.smooth_scroll", AsyncMock())
    monkeypatch.setattr("linkedin_hunter.jobs.search.random_mouse_jiggle", AsyncMock())

    mock_page = MagicMock()
    mock_page.goto = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()

    result = asyncio.run(collect_search_jobs(mock_page, cfg, target_count=5))

    # Should collect exactly 5 unique cards: 101, 102, 103, 104, 105
    assert len(result) == 5
    assert [c.linkedin_id for c in result] == ["101", "102", "103", "104", "105"]


@pytest.mark.asyncio
async def test_prompted_answer_is_not_stored_in_memory(monkeypatch, tmp_path):
    """Prompted application answers must be used for the current form only and NOT persisted to memory."""
    from linkedin_hunter.forms.filler import _fill_select, _fill_text
    from linkedin_hunter.forms.memory import UserMemory

    mem_file = tmp_path / "memory.yaml"
    mock_memory = UserMemory(memory_path=mem_file)

    monkeypatch.setattr("linkedin_hunter.forms.filler._get_memory", lambda: mock_memory)
    monkeypatch.setattr(
        "linkedin_hunter.forms.filler.prompt_user_for_input",
        AsyncMock(return_value="Yes"),
    )

    mock_field = MagicMock()
    mock_field.label = "Do you have hands-on experience with API testing?"
    mock_field.required = True
    mock_field.options = ["Yes", "No"]
    mock_field.element = MagicMock()
    mock_field.element.select_option = AsyncMock()

    cfg = HunterConfig()
    success = await _fill_select(MagicMock(), mock_field, cfg)

    assert success is True
    # Memory must remain empty
    assert len(mock_memory.get_all()) == 0
    assert mock_memory.lookup(mock_field.label) is None


def test_numeric_option_matching_priority_no_off_by_one():
    """Numeric matching must prioritize number value in label over 1-based index."""
    from linkedin_hunter.forms.filler import match_option_to_choices

    options = [
        "0 month", "1 month", "2 months", "3 months", "4 months",
        "5 months", "6 months", "7 months", "8 months", "9 months", "10 months",
    ]

    # Critical fix: "9" must match "9 months", NOT "8 months" (the 9th item)
    assert match_option_to_choices("9", options) == "9 months"
    assert match_option_to_choices("10", options) == "10 months"
    assert match_option_to_choices("0", options) == "0 month"
    assert match_option_to_choices("2", options) == "2 months"
    assert match_option_to_choices("9 months", options) == "9 months"

    # Positional index fallback when options have no numbers
    non_numeric_options = ["High School", "Bachelor's Degree", "Master's Degree"]
    assert match_option_to_choices("2", non_numeric_options) == "Bachelor's Degree"
    assert match_option_to_choices("1", non_numeric_options) == "High School"
    assert match_option_to_choices("3", non_numeric_options) == "Master's Degree"


def test_api_tools_question_matching():
    """Specific questions asking which tools were used for API testing must receive tool answers, not just 'Yes'."""
    cfg = load_config()

    q_tools = "Do you have experience with API testing? If yes, which tools have you used?"
    assert match_answer(q_tools, cfg.answers, cfg.profile) == "Postman"

    q_binary = "Do you have hands-on experience with API testing?"
    assert match_answer(q_binary, cfg.answers, cfg.profile) == "Yes"

    q_manual_auto = "Have you worked on both manual and automation testing?"
    assert match_answer(q_manual_auto, cfg.answers, cfg.profile) == "Yes"

    q_jira = "Do you have experience using Jira for defect tracking?"
    assert match_answer(q_jira, cfg.answers, cfg.profile) == "Yes"


def test_portfolio_url_mapped_to_github():
    """Questions asking for online portfolio URL should map to profile github_url."""
    cfg = load_config()

    q_portfolio = "Please enter your online portfolio URL"
    assert match_answer(q_portfolio, cfg.answers, cfg.profile) == "https://github.com/thejanmejay"

    q_github = "GitHub profile URL"
    assert match_answer(q_github, cfg.answers, cfg.profile) == "https://github.com/thejanmejay"


def test_immediate_joiner_answers_no_when_notice_period_set():
    """Immediate joiner questions should resolve to False / No based on 30-day notice period."""
    cfg = load_config()

    q1 = "Can you start immediately?"
    assert match_yes_no(q1, cfg.answers) is False

    q2 = "Are you an immediate joiner?"
    assert match_yes_no(q2, cfg.answers) is False

    q3 = "Are you available to join immediately?"
    assert match_yes_no(q3, cfg.answers) is False


def test_split_experience_years_and_months():
    """Split experience forms should match 1 year for total years and 10 months for additional months."""
    from linkedin_hunter.forms.filler import match_option_to_choices
    cfg = load_config()

    # Total years of experience (1)
    q_years = "Please select your total years of professional experience:"
    ans_years = match_answer(q_years, cfg.answers, cfg.profile)
    assert ans_years == "1"
    year_options = ["0 years", "1 year", "2 years", "3 years", "4 years", "5+ years"]
    assert match_option_to_choices(ans_years, year_options) == "1 year"

    # Additional months of experience (10)
    q_months = "Please select your total additional months of experience:"
    ans_months = match_answer(q_months, cfg.answers, cfg.profile)
    assert ans_months == "10"
    month_options = ["0 month", "1 month", "2 months", "3 months", "4 months", "5 months", "6 months", "7 months", "8 months", "9 months", "10 months", "11 months"]
    assert match_option_to_choices(ans_months, month_options) == "10 months"

    # Skill-specific experience should still match skill answer (2 years)
    q_java = "How many years of experience do you have in Java?"
    assert match_answer(q_java, cfg.answers, cfg.profile) == "2"






