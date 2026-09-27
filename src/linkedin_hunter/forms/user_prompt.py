import asyncio
import select
import sys
from typing import Optional

from rich.console import Console

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
    lines.append(f"  Type your answer and press Enter (or press Enter alone to skip):")
    lines.append(f"  >>> ")
    return "\n".join(lines)


async def prompt_user_for_input(
    question: str,
    field_type: str = "",
    options: list[str] | None = None,
    timeout: int = USER_INPUT_TIMEOUT,
) -> Optional[str]:
    """Show prompt and wait for user input using non-blocking select on stdin.

    Args:
        question: The form field label/question text.
        field_type: The type of field (text, select, radio, etc.).
        options: Available options for select/radio fields.
        timeout: Seconds to wait for user input.

    Returns:
        The user's answer string, or None if timed out / skipped.
    """
    log.info("[PROMPT] Waiting for input: question=%r field_type=%s options=%r", question, field_type, options)
    prompt_text = _blink_prompt(question, field_type, options)

    # Print blinking header using ANSI escape codes
    sys.stdout.write("\033[5m\033[1;33m")  # blink + bold yellow
    sys.stdout.write("\n  ⚡ ATTENTION: Form question needs your input! ⚡\n")
    sys.stdout.write("\033[0m")  # reset
    sys.stdout.flush()

    console.print(prompt_text, highlight=False)

    elapsed = 0.0
    tick = 0.25
    answer: Optional[str] = None

    # Use select on stdin (Unix) or non-blocking check
    while elapsed < timeout:
        try:
            readable, _, _ = select.select([sys.stdin], [], [], 0.0)
            if readable:
                log.info("[PROMPT] stdin data detected")
                raw_line = sys.stdin.readline()
                log.info("[PROMPT] Raw user input received: %r", raw_line)
                if raw_line is not None and raw_line.strip():
                    answer = raw_line.strip()
                    log.info("[PROMPT] Parsed user input: %r", answer)
                    break
                elif raw_line is not None:
                    log.info("[PROMPT] User entered empty line (skipped)")
                    break
        except Exception as e:
            log.warning("[PROMPT] Stdin select exception: %s", e)
            break

        remaining = timeout - elapsed
        if int(remaining) % 5 == 0 and abs(remaining - round(remaining)) < 0.26 and remaining > 0:
            sys.stdout.write(f"\r  ⏱  {int(round(remaining))}s remaining...  >>> ")
            sys.stdout.flush()

        await asyncio.sleep(tick)
        elapsed += tick

    if not answer:
        console.print(f"\n  [dim]⏱  Timed out or skipped — application will be safely abandoned[/dim]")
        console.print(f"{'=' * 60}\n")
        log.warning("[PROMPT] TIMEOUT / No input received for question=%r", question)
        return None

    console.print(f"\n  [green]✓ Got it![/green] Answer received.")
    console.print(f"{'=' * 60}\n")
    log.info("[PROMPT] Returning answer: %r for question=%r", answer, question)
    return answer
