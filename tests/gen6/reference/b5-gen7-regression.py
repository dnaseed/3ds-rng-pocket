"""Compare visible Gen 7 search results on the v1.3.0 and candidate previews."""
import json
import re
import sys

from playwright.sync_api import expect, sync_playwright


def read_results(browser, url, game):
    context = browser.new_context(viewport={"width": 1366, "height": 768})
    profile = {
        "id": "gen7-qa", "name": f"QA {game}", "gameVersion": game, "tid": 0, "sid": 0,
        "tsv": 0, "trv": 0, "shinyCharm": False, "eggSeed": [1, 2, 3, 4], "otherTsvs": [],
    }
    settings = {"lang": "en", "initialSeedHex": "35B19AF2"}
    profiles = {"version": 1, "activeProfileId": profile["id"], "profiles": [profile]}
    context.add_init_script(
        "localStorage.setItem('usum_rng_profiles_v1', JSON.stringify(" + json.dumps(profiles) + "));"
        "localStorage.setItem('usum_rng_settings_v1', JSON.stringify(" + json.dumps(settings) + "));"
    )
    page = context.new_page()
    page.set_default_timeout(7000)
    page.goto(url)
    page.get_by_role("button", name=re.compile("Generation 7")).click()
    results = {}
    for tab, limit in [
        ("Stationary", "487"), ("Wild", "487"), ("Egg", "9"),
        ("Event", "487"), ("ID RNG", "1141"), ("Tools", "5000"),
    ]:
        page.get_by_role("navigation").get_by_role("button", name=tab, exact=True).filter(visible=True).click()
        page.get_by_label("Index count" if tab == "Tools" else "Max Frame", exact=True).fill(limit)
        page.get_by_role("button", name="Calculate" if tab == "Tools" else "Search", exact=True).click()
        output = page.get_by_role("region", name="Infection frames") if tab == "Tools" else page.locator(".workspace-results")
        expect(output.get_by_text(re.compile(r"^\d[\d,.]* results?$")).first).to_be_visible()
        results[tab] = " ".join(output.inner_text().split())
    context.close()
    return results


if __name__ == "__main__":
    legacy, candidate = sys.argv[1:3]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome")
        for game in ("M", "US"):
            expected = read_results(browser, legacy, game)
            actual = read_results(browser, candidate, game)
            for tab in expected:
                assert actual[tab] == expected[tab], (game, tab, expected[tab], actual[tab])
            print(f"{game}: Gen 7 search outputs match v1.3.0 in all six views", flush=True)
        browser.close()

