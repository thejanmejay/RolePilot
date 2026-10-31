"""Tests for Playwright Chromium availability diagnostics, Render path configuration, and fail-fast checks."""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from backend.app.services.browser_diagnostics import (
    BrowserUnavailableException,
    check_chromium_availability,
    configure_playwright_browsers_path,
    get_playwright_version,
    verify_browser_runtime,
)
from linkedin_hunter.browser.engine import BrowserEngine
from linkedin_hunter.config import BrowserConfig, HunterConfig


def test_get_playwright_version():
    """Verify Playwright version string is non-empty and accessible."""
    version = get_playwright_version()
    assert version is not None
    assert isinstance(version, str)
    assert len(version) > 0


def test_configure_playwright_browsers_path_respects_existing_env():
    """Verify existing PLAYWRIGHT_BROWSERS_PATH is preserved if set."""
    with patch.dict(os.environ, {"PLAYWRIGHT_BROWSERS_PATH": "custom/path"}):
        path = configure_playwright_browsers_path()
        assert path == "custom/path"


def test_configure_playwright_browsers_path_auto_sets_zero_on_render():
    """Verify PLAYWRIGHT_BROWSERS_PATH defaults to '0' on Render."""
    env = os.environ.copy()
    env.pop("PLAYWRIGHT_BROWSERS_PATH", None)
    env["RENDER"] = "true"
    with patch.dict(os.environ, env, clear=True):
        path = configure_playwright_browsers_path()
        assert path == "0"
        assert os.environ.get("PLAYWRIGHT_BROWSERS_PATH") == "0"


def test_check_chromium_availability_reports_diagnostics_when_missing():
    """Verify check_chromium_availability returns structured fields when binary is missing."""
    with patch("backend.app.services.browser_diagnostics.find_existing_chromium_executable", return_value=("/opt/render/.cache/ms-playwright/chrome", False)):
        mock_p = MagicMock()
        mock_p.chromium.executable_path = "/opt/render/.cache/ms-playwright/chrome"

        mock_sync = MagicMock()
        mock_sync.return_value.__enter__.return_value = mock_p

        with patch("playwright.sync_api.sync_playwright", mock_sync):
            diag = check_chromium_availability()
            assert diag["available"] is False
            assert diag["browser"] == "chromium"
            assert diag["status"] == "missing_executable"
            assert diag["binary_exists"] is False
            assert "expected_executable_path" in diag
            assert "playwright_version" in diag
            assert "PLAYWRIGHT_BROWSERS_PATH=0" in diag["remediation"]


def test_verify_browser_runtime_raises_fail_fast_on_missing_browser():
    """Verify verify_browser_runtime raises BrowserUnavailableException when browser is not runnable."""
    with patch("backend.app.services.browser_diagnostics.check_chromium_availability", return_value={
        "available": False,
        "browser": "chromium",
        "error": "Chromium browser binary or system dependencies are unavailable.",
        "details": "Chromium binary not found at /opt/render/.cache/ms-playwright/chrome",
        "remediation": "Set PLAYWRIGHT_BROWSERS_PATH=0 and install chromium",
    }):
        with pytest.raises(BrowserUnavailableException) as exc_info:
            verify_browser_runtime()
        assert "Chromium browser binary or system dependencies are unavailable" in str(exc_info.value)
        assert exc_info.value.diagnostics["available"] is False


from unittest.mock import AsyncMock, MagicMock, patch

@pytest.mark.asyncio
async def test_browser_engine_enforces_headless_on_render():
    """Verify BrowserEngine forces headless=True in Render environment even if config is False."""
    hunter_config = HunterConfig()
    hunter_config.browser.headless = False  # Config set to headful

    engine = BrowserEngine(hunter_config)

    mock_playwright = MagicMock()
    mock_browser = MagicMock()
    mock_context = MagicMock()
    mock_page = MagicMock()

    mock_playwright.chromium.executable_path = sys.executable
    mock_playwright.chromium.launch = AsyncMock(return_value=mock_browser)
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    mock_context.new_page = AsyncMock(return_value=mock_page)

    with patch.dict(os.environ, {"RENDER": "true"}):
        with patch("linkedin_hunter.browser.engine.async_playwright") as mock_apw, \
             patch("linkedin_hunter.browser.engine.apply_stealth", new_callable=AsyncMock):
            mock_apw.return_value.start = AsyncMock(return_value=mock_playwright)

            # launch without explicit headless param
            await engine.launch()

            # verify chromium.launch was called with headless=True
            mock_playwright.chromium.launch.assert_called_once()
            call_kwargs = mock_playwright.chromium.launch.call_args[1]
            assert call_kwargs["headless"] is True


@pytest.mark.asyncio
async def test_browser_engine_preserves_local_headless_config_outside_render():
    """Verify BrowserEngine respects hunter_config.browser.headless when not on Render or headless server."""
    hunter_config = HunterConfig()
    hunter_config.browser.headless = False

    engine = BrowserEngine(hunter_config)

    mock_playwright = MagicMock()
    mock_browser = MagicMock()
    mock_context = MagicMock()
    mock_page = MagicMock()

    mock_playwright.chromium.executable_path = sys.executable
    mock_playwright.chromium.launch = AsyncMock(return_value=mock_browser)
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    mock_context.new_page = AsyncMock(return_value=mock_page)

    env = os.environ.copy()
    env.pop("RENDER", None)
    env.pop("ENVIRONMENT", None)
    env["DISPLAY"] = ":0"  # Simulating desktop display

    with patch.dict(os.environ, env, clear=True):
        with patch("linkedin_hunter.browser.engine.async_playwright") as mock_apw, \
             patch("linkedin_hunter.browser.engine.apply_stealth", new_callable=AsyncMock):
            mock_apw.return_value.start = AsyncMock(return_value=mock_playwright)

            await engine.launch()

            mock_playwright.chromium.launch.assert_called_once()
            call_kwargs = mock_playwright.chromium.launch.call_args[1]
            assert call_kwargs["headless"] is False



def test_render_build_script_contains_playwright_browsers_path():
    """Verify render_build.sh script sets PLAYWRIGHT_BROWSERS_PATH=0 and uses python -m commands."""
    script_path = Path("scripts/render_build.sh")
    assert script_path.exists()
    content = script_path.read_text()

    assert "export PLAYWRIGHT_BROWSERS_PATH=0" in content
    assert "python -m pip install" in content
    assert "python -m playwright install --with-deps chromium" in content


def test_render_yaml_configures_playwright_browsers_path():
    """Verify render.yaml contains PLAYWRIGHT_BROWSERS_PATH=0 for both web and worker services."""
    yaml_path = Path("render.yaml")
    assert yaml_path.exists()
    content = yaml_path.read_text()

    assert "PLAYWRIGHT_BROWSERS_PATH" in content
    assert 'value: "0"' in content
