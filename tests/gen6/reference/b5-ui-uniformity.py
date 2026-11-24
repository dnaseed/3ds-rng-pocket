import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

URL = "http://127.0.0.1:4176/"


def verify(browser, width, height):
    page = browser.new_page(viewport={"width": width, "height": height}, has_touch=width < 1024)
    page.add_init_script("localStorage.setItem('usum_rng_settings_v1', JSON.stringify({lang:'en'}));")
    page.goto(URL)
    page.set_default_timeout(5000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def button(name, scope=page):
        return scope.get_by_role("button", name=name, exact=isinstance(name, str)).filter(visible=True)

    def set_frames(lo, hi):
        page.get_by_label("Min Frame", exact=True).fill(str(lo))
        page.get_by_label("Max Frame", exact=True).fill(str(hi))

    def results_count(count):
        expect(page.get_by_role("status").filter(has_text=re.compile(rf"^{count} results$"))).to_be_visible()

    for number, versions in [(6, ("X", "Y", "OR", "AS")), (7, ("US", "UM", "S", "M"))]:
        card = button(re.compile(f"Generation {number}"))
        expect(card.get_by_text("Active", exact=True)).to_be_visible()
        for version in versions:
            expect(card.get_by_text(version, exact=True)).to_be_visible()

    button(re.compile("Generation 6")).click()
    seed = button(re.compile("^MT seed"))
    seed.click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("MT seed (hex)", exact=True).fill("123")
    page.keyboard.press("Escape")
    expect(seed).to_be_focused()
    expect(seed).not_to_contain_text("00000123")
    seed.click()
    dialog.get_by_label("MT seed (hex)", exact=True).fill("35b19af2")
    button("Apply", dialog).click()
    expect(page.get_by_label("MT seed (hex)", exact=True)).to_have_value("35B19AF2")
    button(re.compile("^Target Frame")).click()
    dialog.get_by_label("Target Frame", exact=True).fill("5050")
    page.keyboard.press("Escape")
    expect(page.get_by_label("Target Frame", exact=True)).to_have_value("5050")

    for mode in ("Egg", "Event"):
        if width < 1024 and mode == "Event":
            button("More").click()
        button(mode).click()
        set_frames(5200, 5200)
        button("Search").click()
        results_count(1)
        row = button(re.compile(r"^#5200\b"))
        ivs = [int(node.split()[1]) for node in row.locator('[role=img]').evaluate_all(
            "nodes => nodes.map(node => node.getAttribute('aria-label'))"
        )]
        assert len(ivs) == 6, ivs
        set_frames(0, 5200)
        button("Filters").click()
        if mode == "Event":
            expect(dialog.get_by_role("button", name=re.compile("Square"))).to_have_count(0)
        for stat, iv in zip(("HP", "Atk", "Def", "SpA", "SpD", "Spe"), ivs):
            dialog.get_by_label(f"{stat} Min", exact=True).fill(str(iv))
            dialog.get_by_label(f"{stat} Max", exact=True).fill(str(iv))
        page.keyboard.press("Escape")
        expect(button(re.compile(r"^Filters\s*1$"))).to_be_focused()
        button("Search").click()
        expect(row).to_be_visible()
        results_count(1)

    button("Stationary").click()
    set_frames(0, 5100)
    last_parameter = page.get_by_label("Max Frame", exact=True)
    last_parameter.focus()
    assert page.locator(".workspace-params").evaluate(
        "params => !!(params.compareDocumentPosition(document.querySelector('.workspace-actions')) & Node.DOCUMENT_POSITION_FOLLOWING)"
    )
    button("Search").click()
    results_count(5000)
    region = page.get_by_role("region", name="results", exact=True)
    expect(region).to_be_visible()
    assert region.get_by_role("listitem").count() < 50
    region.focus()
    page.keyboard.press("End")
    last_row = button(re.compile(r"^#4999\b"))
    expect(last_row).to_be_focused()
    page.keyboard.press("Enter")
    expect(dialog).to_be_visible()
    region.evaluate("node => node.scrollTop = 0")
    page.keyboard.press("Escape")
    expect(last_row).to_be_focused()
    expect(last_row).to_be_in_viewport()

    if width < 1024:
        button("Collapse").click()
        expect(last_parameter).to_be_hidden()
        button("Edit settings").click()
        expect(last_parameter).to_be_visible()

    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert not errors, errors
    screenshots = Path(".tmp")
    if width in (390, 1366):
        page.screenshot(path=screenshots / f"gen6-ui-{width}.png")
    print(f"{width}x{height}: header, filters beyond frame 5000, virtual list keyboard and focus OK", flush=True)
    page.close()


if __name__ == "__main__":
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome")
        for size in ((360, 740), (390, 844), (1024, 600), (1366, 768)):
            verify(browser, *size)
        browser.close()
