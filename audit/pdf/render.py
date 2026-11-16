from pathlib import Path
import shutil
from .teaser import render_html


def render_pdf(business_name: str, score: int, findings: list[str], output: str | Path) -> Path:
    """Render through Chromium/Playwright; keeps PDF generation out of scoring logic."""
    from playwright.sync_api import sync_playwright

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        executable = shutil.which("chromium") or shutil.which("google-chrome")
        browser = playwright.chromium.launch(headless=True, executable_path=executable)
        page = browser.new_page()
        page.set_content(render_html(business_name, score, findings), wait_until="load")
        page.pdf(path=str(output_path), format="A4", print_background=True)
        browser.close()
    return output_path

