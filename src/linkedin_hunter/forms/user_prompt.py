"""Interactive user prompt with blinking notification and timeout.

When the form filler gets stuck on a question it can't answer,
this module shows a blinking prompt in the terminal sidebar so the
user can provide an answer within 15 seconds. If no input is given,
returns None and the filler falls back to its default behavior.
"""

from __future__ import annotations

import asyncio
import sys
import threading
from typing import Optional

from rich.console import Console
from rich.text import Text

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

USER_INPUT_TIMEOUT = 15  # seconds

console = Console()


def _blink_prompt(question: str, field_type: str, options: list[str] | None = None) -> str:
    """Build the prompt message shown to the user."""
    lines = []
    lines.append(f"\n{'=' * 60}")
    lines.append(f"  ⚡ INPUT NEEDED — {USER_INPUT_TIMEOUT}s to respond")
    lines.append(f"{'=' * 60}")
    lines.append(f"  Question: {question}")
    if field_type:
        lines.append(f"  Field type: {field_type}")
    if options:
        lines.append(f"  Options: {', '.join(options[:10])}")
    lines.append(f"{'─' * 60}")
    lines.append(f"  Type your answer (or press Enter to skip):")
    lines.append(f"  >>> ")
    return "\n".join(lines)


async def prompt_user_for_input(
    question: str,
    field_type: str = "",
    options: list[str] | None = None,
    timeout: int = USER_INPUT_TIMEOUT,
) -> Optional[str]:
    """Show a blinking prompt and wait for user input with a timeout.

    Args:
        question: The form field label/question text.
        field_type: The type of field (text, select, radio, etc.).
        options: Available options for select/radio fields.
        timeout: Seconds to wait for user input.

    Returns:
        The user's answer string, or None if timed out / skipped.
    """
    prompt_text = _blink_prompt(question, field_type, options)

    # Print blinking header using ANSI escape codes
    # \033[5m = blink, \033[0m = reset
    sys.stdout.write("\033[5m\033[1;33m")  # blink + bold yellow
    sys.stdout.write("\n  ⚡ ATTENTION: Form question needs your input! ⚡\n")
    sys.stdout.write("\033[0m")  # reset
    sys.stdout.flush()

    console.print(prompt_text, highlight=False)

    # Use a thread to read stdin without blocking the async event loop
    result: list[Optional[str]] = [None]

    def _read_input():
        try:
            line = input()
            result[0] = line.strip() if line.strip() else None
        except (EOFError, KeyboardInterrupt):
            result[0] = None

    input_thread = threading.Thread(target=_read_input, daemon=True)
    input_thread.start()

    # Wait for user input or timeout
    elapsed = 0.0
    tick = 0.5
    while elapsed < timeout:
        if not input_thread.is_alive():
            break
        # Print countdown every 5 seconds
        remaining = timeout - elapsed
        if int(remaining) % 5 == 0 and remaining == int(remaining) and remaining > 0:
            sys.stdout.write(f"\r  ⏱  {int(remaining)}s remaining...  >>> ")
            sys.stdout.flush()
        await asyncio.sleep(tick)
        elapsed += tick

    if input_thread.is_alive():
        # Timed out
        console.print(f"\n  [dim]⏱  Timed out after {timeout}s — using default[/dim]")
        console.print(f"{'=' * 60}\n")
        log.info("User prompt timed out for: %s", question[:60])
        return None

    answer = result[0]
    if answer:
        console.print(f"\n  [green]✓ Got it![/green] Saved '{answer}' to memory.")
    else:
        console.print(f"\n  [dim]Skipped — using default[/dim]")
    console.print(f"{'=' * 60}\n")

    return answer
