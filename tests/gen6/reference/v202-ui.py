"""Browser regression for the v2.0.2 navigation and encounter changes."""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[3]
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4176/"


def run(browser, language, width, height):
    locale = json.loads((ROOT / f"src/data/i18n/ui_{language}.json").read_text(encoding="utf-8"))

    def t(key):
        group, name = key.split(".", 1)
        return locale[group][name]

    context = browser.new_context(viewport={"width": width, "height": height},
                                  is_mobile=width < 1024, has_touch=width < 1024)
    context.add_init_script("""
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function(message, ...rest) {
        if (message.payload?.maxFrame !== undefined) window.auditFrameRange = message.payload;
        return post.call(this, message, ...rest);
      };
    """)
    page = context.new_page()
    page.set_default_timeout(4200)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    def button(name, scope=page):
        return scope.get_by_role("button", name=name, exact=isinstance(name, str)).filter(visible=True)

    def field(label):
        return page.get_by_label(label, exact=True).filter(visible=True)

    def tab(name):
        button(name, page.locator("nav")).first.click()

    def back():
        page.evaluate("window.history.back()")

    def overflow():
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        assert page.locator("header").evaluate("(e) => e.scrollWidth <= e.clientWidth")

    page.goto("about:blank")
    page.goto(URL)
    if language == "it":
        button(re.compile(r"^EN$", re.I)).click()

    def generation(number):
        return button(re.compile(t(f"home.gen{number}Title")))

    generation(7).click()
    overflow()
    tab(t("nav.stationary"))
    if width < 1024:
        tab(t("nav.more"))
        tab(t("profiles.shortTitle"))
    else:
        tab(t("profiles.title"))
    button(t("profiles.newProfile")).click()
    expect(field(t("profiles.name"))).to_be_visible()
    if width < 1024:
        back()  # The first step restores the previous More section.
        expect(button(t("nav.event"), page.locator("nav")).first).to_have_attribute("aria-current", "page")
    back()
    expect(button(t("nav.stationary"), page.locator("nav")).first).to_have_attribute("aria-current", "page")
    back()
    expect(button(t("nav.seed"), page.locator("nav")).first).to_have_attribute("aria-current", "page")
    back()
    expect(generation(7)).to_be_visible()

    generation(6).click()
    overflow()
    header = page.locator("header")
    expect(header).to_contain_text("MT")
    expect(header).to_contain_text("00000000")
    expect(header.get_by_label(t("profiles.language"))).to_be_visible()

    tab(t("nav.stationary"))
    category = field(t("stationary.category"))
    category.select_option(index=1)
    selected_category = category.input_value()
    filter_button = button(re.compile("^" + re.escape(t("search.filters"))))
    filter_button.click()
    button(t("filters.shinyStar"), page.get_by_role("dialog")).click()
    page.keyboard.press("Escape")
    button(t("gen6.tinyTimelineTool")).click()
    expect(button("TinyMT Timeline")).to_have_attribute("aria-pressed", "true")
    back()
    expect(category).to_have_value(selected_category)
    filter_button.click()
    shiny = button(t("filters.shinyStar"), page.get_by_role("dialog"))
    expect(shiny).to_have_attribute("aria-pressed", "true")
    button(t("filters.shinyAll"), page.get_by_role("dialog")).first.click()
    page.keyboard.press("Escape")

    tab(t("nav.wild"))
    method_label = "Metodo" if language == "it" else "Method"
    method = page.get_by_role("combobox", name=re.compile("^" + method_label)).filter(visible=True)
    method.select_option("Fishing")
    button(t("search.modeTimeline")).click()
    expect(button(t("gen6.tinyTimelineTool"))).to_have_count(1)
    button(t("gen6.tinyTimelineTool")).click()
    method.select_option("instant")
    for i, word in enumerate(("11223344", "55667788", "99AABBCC", "DDEEFF00")):
        field(f"S{3-i}").fill(word)
    button(t("app.search")).click()
    expect(page.locator(".workspace-results:visible [role=status]").first).to_be_visible()
    back()
    expect(method).to_have_value("Fishing")
    expect(page.locator("main")).to_contain_text("XY")
    button(t("app.search")).click()
    expect(page.get_by_role("alert")).to_contain_text("Tiny Timeline Tool")
    button(t("gen6.tinyTimelineTool")).click()
    method.select_option("fishing")
    button(t("app.search")).click()
    expect(page.locator(".workspace-results:visible [role=status]").first).to_be_visible()
    back()
    expect(method).to_have_value("Fishing")
    field(t("search.startFrame")).fill("502")
    field(t("search.endFrame")).fill("510")
    button(t("app.search")).click()
    expect(page.locator(".workspace-results:visible")).to_contain_text(t("gen6.activeCalibration").split("{")[0].strip())
    button(re.compile("^" + re.escape(t("search.showStats")) + "$")).click()

    for section in (t("nav.wild"), t("nav.stationary")):
        tab(section)
        button(t("search.modeAround")).click()
        target = field(t("search.targetFrame"))
        target.fill("0")
        page.keyboard.press("Tab")
        expect(target).to_have_value("0")
        expect(page.locator(".workspace-params:visible")).to_contain_text("#0 – #100")
        target.fill("1000000000")
        page.keyboard.press("Tab")
        expect(page.locator(".workspace-params:visible")).to_contain_text("#999999900 – #1000000000")
        button(t("app.search")).click()
        page.wait_for_function("window.auditFrameRange?.maxFrame === 1000000000 && window.auditFrameRange?.minFrame === 999999900")
        button(re.compile(r"^Stop")).click()
        page.evaluate("window.auditFrameRange = null")
        target.fill("0")
        page.keyboard.press("Tab")
        overflow()

    button(t("home.backToMenu"), header).click()
    expect(generation(6)).to_be_visible()
    generation(6).click()
    tab(t("nav.egg"))
    if width < 1024:
        tab(t("nav.more"))
    else:
        tab(t("nav.event"))
    back()
    expect(button(t("nav.egg"), page.locator("nav")).first).to_have_attribute("aria-current", "page")
    back()
    expect(button("Seed MT")).to_be_visible()
    back()
    expect(generation(6)).to_be_visible()
    assert page.url == URL
    page.go_back()
    expect(page).to_have_url("about:blank")
    assert not errors, errors
    context.close()
    print(f"{language} {width}x{height}: history, encounter settings, calibration, bounds and header OK", flush=True)


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome")
        for width, height in ((360, 740), (390, 844), (1024, 600), (1366, 768)):
            for language in ("en", "it"):
                run(browser, language, width, height)
        browser.close()
