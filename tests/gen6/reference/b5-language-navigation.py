"""Exercise the Gen 6 production UI in both languages on desktop and touch viewports."""
import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


URL = "http://127.0.0.1:4176/"
ROOT = Path(__file__).resolve().parents[3]
STATE = ("11223344", "55667788", "99AABBCC", "DDEEFF00")
STATS = ("HP", "Atk", "Def", "SpA", "SpD", "Spe")


def run(browser, language, width, height):
    mobile = width < 1024
    messages = json.loads((ROOT / f"src/data/i18n/ui_{language}.json").read_text(encoding="utf-8"))

    def t(key):
        group, name = key.split(".")
        return messages[group][name]

    context = browser.new_context(viewport={"width": width, "height": height}, has_touch=mobile, is_mobile=mobile)
    context.add_init_script("""
        localStorage.setItem('usum_rng_settings_v1', JSON.stringify({ lang: LANG, initialSeedHex: '35B19AF2' }));
        window.testTerminatedWorkers = 0;
        const terminate = Worker.prototype.terminate;
        Worker.prototype.terminate = function() {
            window.testTerminatedWorkers++;
            return terminate.call(this);
        };
    """.replace("LANG", json.dumps(language)))
    page = context.new_page()
    page.set_default_timeout(6000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def button(name):
        return page.get_by_role("button", name=name, exact=isinstance(name, str)).filter(visible=True)

    def activate(target):
        if mobile:
            target.tap()
        else:
            target.click()

    def open_gen(generation):
        activate(button(re.compile(t(f"home.gen{generation}Title"))))

    def select_tab(name, secondary=False):
        if mobile and secondary:
            activate(button(t("nav.more")))
        activate(button(name))

    def result_count(count):
        expect(page.get_by_role("status").filter(has_text=re.compile(rf"^{count} {t('app.results')}$"))).to_be_visible()

    def search(count=None):
        activate(button(t("app.search")))
        if count is None:
            expect(page.get_by_role("status").filter(has_text=re.compile(rf"^\d+ {t('app.results')}$"))).to_be_visible()
        else:
            result_count(count)

    def frame(label, value):
        page.get_by_label(t(f"search.{label}Frame"), exact=True).filter(visible=True).fill(str(value))

    def detail(index, text):
        row = button(re.compile(rf"^#{index}\b")).first
        if mobile:
            activate(row)
        else:
            row.focus()
            page.keyboard.press("Enter")
        expect(page.get_by_role("dialog")).to_contain_text(text)
        page.keyboard.press("Escape")
        expect(row).to_be_focused()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")

    def state_fields():
        for i, word in enumerate(STATE):
            page.get_by_label(f"S{3-i}", exact=True).fill(word)

    page.goto(URL)
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    context.set_offline(True)
    open_gen(6)
    page.get_by_label(t("gen6.mtSeed"), exact=True).fill("35B19AF2")
    activate(button(t("app.apply")))
    select_tab(t("nav.stationary"))
    frame("end", 9)
    search(10)
    detail(0, "PID")

    select_tab(t("nav.wild"))
    search(10)
    detail(0, "PID")
    select_tab(t("nav.egg"))
    search(10)
    detail(0, "Key0")
    select_tab(t("nav.event"), True)
    search(10)
    detail(0, "EC")

    select_tab("ID RNG", True)
    activate(button(t("app.search")))
    expect(page.get_by_role("alert")).to_have_text(t("gen6.tinyInvalid"))
    state_fields()
    frame("end", 9)
    search(10)
    detail(2, "19091")
    frame("end", 5500)
    search(5000)
    expect(page.get_by_text(t("gen6.resultsLimit").replace("{n}", "5000"), exact=True)).to_be_visible()

    select_tab(t("misc.tools"), True)
    frame("end", 21204)
    frame("start", 21202)
    search(1)
    strain = "Ceppo" if language == "it" else "Strain"
    detail(21203, re.compile(rf"{strain} 3[\s\S]*Rand 42BAC000 · MT 7D292DBC"))
    frame("start", 21204)
    search(0)
    select_tab(t("profiles.shortTitle" if mobile else "profiles.title"), True)
    expect(page.locator("header [aria-haspopup=dialog]").first).to_contain_text("X")
    expect(page.locator(".profile-list [aria-pressed=true]")).to_contain_text("TRV")

    select_tab(t("nav.seed"))
    activate(button("TinyMT Timeline"))
    state_fields()
    search()
    detail(0, STATE[0])
    activate(button(re.compile(r"^#1\b")).first)
    dialog = page.get_by_role("dialog")
    activate(dialog.get_by_role("button", name="Usa questo stato" if language == "it" else "Use this state", exact=True))
    for i, word in enumerate(("AAD57F2A", "E69AFDCC", "55667788", "99AABBCC")):
        expect(page.get_by_label(f"S{3-i}", exact=True)).to_have_value(word)

    activate(button("MT Seed Finder"))
    prior = page.evaluate("testTerminatedWorkers")
    page.get_by_label("Seed min (hex)", exact=True).fill("00000000")
    page.get_by_label("Seed max (hex)", exact=True).fill("10000000")
    activate(button(t("app.search")))
    expect(button(re.compile(r"^Stop"))).to_be_visible()
    activate(page.locator("header [aria-haspopup=dialog]").first)
    activate(page.get_by_role("dialog").get_by_role("button", name=t("home.backToMenu"), exact=True))
    open_gen(7)
    page.wait_for_function("previous => testTerminatedWorkers > previous", arg=prior)
    activate(page.locator("header").get_by_role("button", name=re.compile(r"^US\b")))
    activate(page.get_by_role("dialog").get_by_role("button", name=t("home.backToMenu"), exact=True))
    open_gen(6)
    expect(page.get_by_label(t("gen6.mtSeed"), exact=True)).to_have_value("35B19AF2")
    page.get_by_label(t("gen6.mtSeed"), exact=True).fill("00000000")
    activate(button(t("app.apply")))
    activate(button("MT Seed Finder"))

    # Retry after leaving and re-entering Gen 6. The old result must not appear in this view.
    expect(page.get_by_role("status").filter(has_text=re.compile(r"^\d+"))).to_have_count(0)
    page.get_by_role("combobox", name=re.compile("^Catture" if language == "it" else "^Captures")).select_option("2")
    groups = [page.get_by_role("group", name=("Cattura " if language == "it" else "Capture ") + str(i)) for i in (1, 2)]
    calculator = groups[0].locator("section")
    calc_button = calculator.get_by_role("button", name=re.compile(t("filters.calcIvs")))
    activate(calc_button)
    calculator.get_by_label(t("event.species"), exact=True).select_option("24")
    calculator.get_by_label(t("filters.level"), exact=True).fill("50")
    calculator.get_by_label(t("search.nature"), exact=True).select_option("0")
    for stat, value in zip(STATS, (135, 105, 85, 80, 90, 95)):
        calculator.get_by_role("spinbutton", name=stat, exact=True).fill(str(value))
    expect(calculator.get_by_text("Atk 30–31", exact=True)).to_be_visible()
    expect(calculator.get_by_role("button", name=t("filters.applyRanges"), exact=True)).to_be_disabled()
    activate(calc_button)
    for group, start, end, ivs in zip(groups, (1, 20), (11, 32), [(31, 1, 5, 5, 2, 27), (31, 30, 8, 23, 20, 15)]):
        group.get_by_label(t("search.startFrame"), exact=True).fill(str(start))
        group.get_by_label(t("search.endFrame"), exact=True).fill(str(end))
        for stat, value in zip(STATS, ivs):
            group.get_by_label(stat, exact=True).fill(str(value))
    groups[1].get_by_label(t("search.startFrame"), exact=True).fill("10")
    activate(button(t("app.search")))
    expect(page.get_by_role("alert")).to_be_visible()
    groups[1].get_by_label(t("search.startFrame"), exact=True).fill("20")
    page.get_by_label("Seed min (hex)", exact=True).fill("35B19AE0")
    page.get_by_label("Seed max (hex)", exact=True).fill("35B19B00")
    for workers in ("1", "2", "4"):
        page.get_by_role("combobox", name=re.compile("^Worker")).select_option(workers)
        search(1)
        expect(page.locator(".workspace-results").get_by_text(re.compile(r"^#2 "))).to_be_visible()
        expect(page.locator(".workspace-results").get_by_text(re.compile(r"^#23 "))).to_be_visible()
        expect(page.get_by_text(re.compile(rf"33 seed · {workers} worker"))).to_be_visible()

    activate(button("Applica seed" if language == "it" else "Apply seed"))
    expect(page.get_by_label(t("gen6.mtSeed"), exact=True)).to_have_value("35B19AF2")
    select_tab(t("nav.stationary"))
    frame("start", 0)
    frame("end", 0)
    search(1)
    detail(0, "35B19AF2")

    assert not errors, errors
    print(f"{language} {width}x{height}: all Gen 6 views offline, generation switch and exact two-capture Finder verified", flush=True)
    context.close()


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome")
        for size in ((360, 740), (390, 844), (1024, 600), (1366, 768)):
            for language in ("en", "it"):
                run(browser, language, *size)
        browser.close()

