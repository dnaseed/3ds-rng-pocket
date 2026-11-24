import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:4176/"
VECTORS = json.loads((Path(__file__).resolve().parent.parent / "b5-reference.json").read_text(encoding="utf8"))


def button(page, name):
    return page.get_by_role("button", name=name, exact=isinstance(name, str))


def select(page, name, value):
    page.get_by_role("combobox", name=re.compile(r"^" + re.escape(name) + r"\b")).select_option(str(value))


def select_profile(page, profile):
    names = {"qa-x": "QA X", "qa-y": "QA Y", "qa-or": "QA OR", "qa-as": "QA AS", "qa-nav": "QA DexNav"}
    page.locator("header [aria-haspopup=dialog]").first.click()
    page.get_by_role("dialog").get_by_role("button", name=re.compile(names[profile])).click()


def iv_text(ivs):
    return " ".join(f"{int(iv):02d}" for iv in re.split(r"[,/]", ivs))


def card_bytes():
    card = bytearray(0x108)
    card[0x82] = 25
    card[0x68:0x6a] = (12345).to_bytes(2, "little")
    card[0x6a:0x6c] = (54321).to_bytes(2, "little")
    card[0x70:0x74] = (0x10203040).to_bytes(4, "little")
    card[0xA0:0xA4] = bytes([3, 1, 2, 0])
    card[0xAF:0xB5] = bytes([31, 30, 5, 9, 31, 8])
    card[0xD0] = 50
    card[0xD4:0xD8] = (0x12345678).to_bytes(4, "little")
    return bytes(card)


def upload(page, name, data):
    page.locator("input[type=file]").set_input_files(
        files={"name": name, "mimeType": "application/octet-stream", "buffer": data}
    )


def result_details(page, frame):
    trigger = button(page, re.compile(rf"^#{frame}\b"))
    trigger.click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    result = dialog.inner_text()
    page.keyboard.press("Escape")
    expect(trigger).to_be_focused()
    return result


def test_card_imports(page):
    button(page, "Event").click()
    card = card_bytes()
    upload(page, "gift.wc6", card)
    expect(page.get_by_label("EC (hex)", exact=True)).to_have_value("10203040")
    expect(page.get_by_label("PID (hex)", exact=True)).to_have_value("12345678")
    page.get_by_label("Min Frame", exact=True).fill("0")
    page.get_by_label("Max Frame", exact=True).fill("0")
    button(page, "Search").click()
    raw = result_details(page, 0)
    assert iv_text("31,30,5,31,8,9") in " ".join(raw.split()) and "Adamant" in raw
    assert "12345678" in raw and "10203040" in raw

    # A second valid file updates the existing form, then the full container restores it.
    different = bytearray(card)
    different[0x70:0x74] = (0xBAADC0DE).to_bytes(4, "little")
    upload(page, "second.wc6", bytes(different))
    expect(page.get_by_label("EC (hex)", exact=True)).to_have_value("BAADC0DE")
    upload(page, "gift.wc6full", bytes([0xFF]) * 0x208 + card)
    expect(page.get_by_label("EC (hex)", exact=True)).to_have_value("10203040")
    button(page, "Search").click()
    assert result_details(page, 0) == raw

    for name, invalid in [
        ("item.wc6", card[:0x51] + bytes([1]) + card[0x52:]),
        ("short.wc6", card[:-1]),
        ("pid-type.wc6", card[:0xA3] + bytes([4]) + card[0xA4:]),
        ("gen7.wc7", card),
    ]:
        upload(page, name, invalid)
        expect(page.get_by_role("alert")).to_contain_text("Select a valid Gen 6 Pokémon Wonder Card")
        expect(page.get_by_label("EC (hex)", exact=True)).to_have_value("10203040")

    button(page, "Seed").click()
    button(page, "Event").click()
    page.get_by_label("EC (hex)", exact=True).fill("10203040")
    page.get_by_label("Use player ID", exact=True).uncheck()
    page.get_by_label("TID", exact=True).fill("12345")
    page.get_by_label("SID", exact=True).fill("54321")
    select(page, "PID", 3)
    page.get_by_label("PID (hex)", exact=True).fill("12345678")
    select(page, "Nature", 3)
    select(page, "Gender", 2)
    select(page, "Ability", 3)
    for stat, value in zip(("HP", "Atk", "Def", "SpA", "SpD", "Spe"), (31, 30, 5, 31, 8, 9)):
        select(page, stat, value)
    button(page, "Search").click()
    assert result_details(page, 0) == raw


def test_your_id_event_egg(page):
    card = bytearray(card_bytes())
    card[0x70:0x74] = bytes(4)
    card[0xA0:0xA4] = bytes([0xFF, 3, 3, 2])
    card[0xAF:0xB5] = bytes([0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])
    card[0xB5] = 3
    card[0xD0:0xD2] = bytes([1, 1])
    button(page, "Event").click()
    for profile in ("qa-x", "qa-y", "qa-or", "qa-as"):
        select_profile(page, profile)
        page.get_by_label("Min Frame", exact=True).fill("0")
        page.get_by_label("Max Frame", exact=True).fill("0")
        upload(page, "egg.wc6full", bytes(0x208) + bytes(card))
        expect(page.get_by_label("Use player ID", exact=True)).to_be_checked()
        expect(page.get_by_role("checkbox", name="Egg", exact=True)).to_be_checked()
        expect(page.get_by_label("Guaranteed perfect IVs", exact=True)).to_have_value("3")
        for other_info in (True, False):
            page.get_by_label("OT data available", exact=True).set_checked(other_info)
            button(page, "Search").click()
            result = result_details(page, 0)
            oras = profile in ("qa-or", "qa-as")
            row = next(item["rows"][0] for item in VECTORS["eventOt"] if
                       item["type"] == 2 and item["otherInfo"] == other_info and item["oras"] == oras)
            pid, ec, ivs, *_ = row.split()
            assert pid in result and ec in result and iv_text(ivs) in " ".join(result.split())
            assert "★" in result


def test_stationary_timeline(page, game, delay):
    oras = game == "OR"
    button(page, "Seed").click()
    button(page, "TinyMT Timeline").click()
    select(page, "Method", "cutscene" if oras else "instant")
    for index, word in enumerate(("11223344", "55667788", "99AABBCC", "DDEEFF00")):
        page.get_by_label(f"S{3-index}", exact=True).fill(word)
    button(page, "Add call").click()
    select(page, "Call 2", 1)
    page.get_by_label("Max Frame", exact=True).fill("764")
    page.get_by_label("Consider delay").check()
    page.get_by_label("Delay (F)", exact=True).fill("78")
    page.get_by_label("Cry", exact=True).check()
    page.get_by_label("Cry frame", exact=True).fill("31")
    if oras:
        page.get_by_label("Party size", exact=True).fill("2")
    button(page, "Search").click()
    expect(page.get_by_role("status").filter(has_text=re.compile(r"\d+ results"))).to_be_visible()

    button(page, "Stationary").click()
    page.get_by_label("Category", exact=True).select_option(label="Hoenn Legendary" if oras else "Legendary")
    page.get_by_label("Encounter preset", exact=True).select_option("oras:1:8" if oras else "xy:1:3")
    page.get_by_label("Min Frame", exact=True).fill("502")
    page.get_by_label("Max Frame", exact=True).fill("520")
    page.get_by_text("Advanced settings", exact=True).click()
    page.get_by_label("TinyMT Timeline", exact=True).check()
    select(page, "Synchronize Lead", 3)
    button(page, "Search").click()
    expect(page.get_by_role("status").filter(has_text="10 results")).to_be_visible()
    expected = next(v["rows"] for v in VECTORS["stationary"] if v["game"] == game and v["delay"] == delay)
    for text in expected[:10]:
        frame, _, pid, ec, *_ = text.split()
        result = result_details(page, int(frame))
        assert pid in result and ec in result, (game, frame, pid, ec, result)
    trigger = button(page, re.compile(r"^#502\b"))
    trigger.click()
    for width in (1023, 1024, 1366):
        page.set_viewport_size({"width": width, "height": 768})
        expect(page.get_by_role("dialog")).to_be_visible()
    page.keyboard.press("Escape")
    expect(trigger).to_be_focused()


def test_wild_profile_switch(page):
    button(page, "Wild").click()
    method = page.get_by_role("combobox", name=re.compile("^Method"))
    for profile, count in (("qa-x", 8), ("qa-y", 8), ("qa-or", 5), ("qa-as", 5)):
        select_profile(page, profile)
        expect(method.locator("option")).to_have_count(count)
        method.select_option("Fishing")
        expect(page.get_by_role("combobox", name=re.compile(r"^Rod\b")).locator("option")).to_have_count(3)
    select_profile(page, "qa-x")
    method.select_option("PokeRadar")
    select_profile(page, "qa-or")
    expect(method.locator("option")).to_have_count(5)
    expect(method).to_have_value("Normal")
    method.select_option("DexNav")
    select_profile(page, "qa-x")
    expect(method).to_have_value("Normal")


def test_finder_cancellation(page):
    button(page, "Seed").click()
    button(page, "MT Seed Finder").click()
    low = page.get_by_label("Seed min (hex)", exact=True)
    high = page.get_by_label("Seed max (hex)", exact=True)
    page.get_by_label("HP max", exact=True).fill("3")
    button(page, "Search").click()
    expect(page.get_by_role("alert")).to_have_text("Check seeds, frame windows and IV ranges.")
    expect(button(page, re.compile("^Stop"))).to_have_count(0)
    page.get_by_label("HP max", exact=True).fill("0")
    low.fill("00000000")
    high.fill("10000000")
    select(page, "Worker", 4)
    button(page, "Search").click()
    button(page, re.compile("^Stop")).click()
    expect(button(page, "Search")).to_be_visible()

    low.fill("35B19AE0")
    high.fill("35B19B00")
    select(page, "Nature", 3)
    for stat, value in zip(("HP", "Atk", "Def", "SpA", "SpD", "Spe"), (31, 1, 5, 5, 2, 27)):
        for bound in ("min", "max"):
            page.get_by_label(f"{stat} {bound}", exact=True).fill(str(value))
    button(page, "Search").click()
    expect(page.get_by_text("#2 · Adamant", exact=True)).to_be_visible()
    expect(page.get_by_text("65", exact=True)).to_be_visible()
    expect(page.get_by_role("status").filter(has_text="1 results")).to_be_visible()


def test_egg_key_transfer(page):
    button(page, "Egg").click()
    page.get_by_label("Min Frame", exact=True).fill("0")
    page.get_by_label("Max Frame", exact=True).fill("0")
    button(page, "Search").click()
    button(page, re.compile(r"^#0\b")).click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_contain_text("Key0 6F08226B · Key1 7F5A7341")
    button(dialog, "Use key").click()
    page.keyboard.press("Escape")
    expect(page.get_by_label("Key0", exact=True)).to_have_value("6F08226B")
    expect(page.get_by_label("Key1", exact=True)).to_have_value("7F5A7341")
    expect(page.get_by_text("PID — · EC 8D44234B", exact=True)).to_be_visible()
    page.get_by_label("Key0", exact=True).fill("7F5A7341")
    page.get_by_label("Key1", exact=True).fill("6F08226B")
    expect(page.get_by_text("PID — · EC 8D44234B", exact=True)).to_have_count(0)


def test_radar_zones_and_encounter(page):
    radar = VECTORS["radar"]
    button(page, "Seed").click()
    button(page, "TinyMT Timeline").click()
    select(page, "Method", "radar")
    for index, word in enumerate(radar["words"]):
        page.get_by_label(f"S{3 - index}", exact=True).fill(word)
    page.get_by_label("Party size", exact=True).fill("2")
    page.get_by_label("Chain length", exact=True).fill("40")
    page.get_by_label("Boost", exact=True).check()
    button(page, "Search").click()
    button(page, re.compile(r"^#0\b")).first.click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_contain_text(f"Music {radar['music']}")
    actual = ["".join(row.split()).replace("·", "#") for row in dialog.locator("pre").inner_text().splitlines()]
    assert actual == radar["map"]
    for patch in radar["patches"]:
        coords, state = patch.rsplit(" ", 1)
        expect(dialog).to_contain_text(f"({coords}) · {state}")
    page.keyboard.press("Escape")

    button(page, "Wild").click()
    select(page, "Method", "PokeRadar")
    page.get_by_label("Chain length", exact=True).fill("40")
    page.get_by_label("Force shiny", exact=True).check()
    button(page, "Search").click()
    result = result_details(page, 0)
    assert "◇" in result
    pid, ec, *_ = next(v["rows"][0] for v in radar["encounters"] if v["forceShiny"]).split()
    assert pid in result and ec in result


def test_dexnav_routes(page):
    select_profile(page, "qa-or")
    button(page, "Seed").click()
    button(page, "TinyMT Timeline").click()
    select(page, "Method", "instant")
    select(page, "Call 1", 1)
    for index, word in enumerate(("11223344", "55667788", "99AABBCC", "DDEEFF00")):
        page.get_by_label(f"S{3 - index}", exact=True).fill(word)
    button(page, "Search").click()
    expect(page.get_by_role("status").filter(has_text=re.compile(r"\d+ results"))).to_be_visible()

    for profile in ("qa-or", "qa-as"):
        select_profile(page, profile)
        button(page, "Wild").click()
        select(page, "Method", "DexNav")
        page.get_by_label("TinyMT Timeline", exact=True).check()
        page.get_by_label("Max Frame", exact=True).fill("502")
        page.get_by_label("Min Frame", exact=True).fill("502")
        page.get_by_label("Search Level", exact=True).fill("201")
        page.get_by_label("Chain length", exact=True).fill("49")
        page.get_by_label("DexNav special slots", exact=True).check()
        button(page, "Search").click()
        details = result_details(page, 502)
        # From the Preview mode of encounter-vectors.ps1.
        for expected in ("DexNav (-9, 2)", "Slot 1", "+19 Lv", "Potential 1", "Egg move ✓", "Boost", "Held Item · 50%"):
            assert expected in details, (profile, expected, details)
        page.get_by_label("Active search", exact=True).uncheck()
        button(page, "Search").click()
        expect(page.get_by_role("status").filter(has_text="0 results")).to_be_visible()


def test_dexnav_forced_shiny(page):
    select_profile(page, "qa-nav")
    button(page, "Seed").click()
    button(page, "TinyMT Timeline").click()
    select(page, "Method", "instant")
    select(page, "Call 1", 1)
    for index, word in enumerate(("11223344", "55667788", "99AABBCC", "000000B0")):
        page.get_by_label(f"S{3 - index}", exact=True).fill(word)
    button(page, "Search").click()
    expect(page.get_by_role("status").filter(has_text=re.compile(r"\d+ results"))).to_be_visible()
    button(page, "Wild").click()
    select(page, "Method", "DexNav")
    page.get_by_label("TinyMT Timeline", exact=True).check()
    page.get_by_label("Search Level", exact=True).fill("999")
    page.get_by_label("Chain length", exact=True).fill("99")
    page.get_by_label("DexNav special slots", exact=True).check()
    page.get_by_label("Unown", exact=True).check()
    page.get_by_text("Advanced settings", exact=True).click()
    page.get_by_label("Delay (F)", exact=True).fill("14")
    select(page, "Synchronize Lead", 3)
    button(page, "Search").click()
    result = result_details(page, 502)
    for text in ("Unown", "◇", "DDEFA5E2", "28011AAF", iv_text("31,16,31,31,25,6"), "HA ✓", "Potential 3"):
        assert text in " ".join(result.split()), result


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    page.set_default_timeout(5000)
    page.goto(BASE_URL)
    button(page, re.compile("^it$", re.I)).click()
    page.evaluate("""localStorage.setItem('gen6_rng_profiles_v1', JSON.stringify({
        generation: 6, version: 1, activeProfileId: 'qa-x',
        profiles: [{ id: 'qa-x', name: 'QA X', gameVersion: 'X', tid: 0, sid: 0, shinyCharm: false },
                   { id: 'qa-or', name: 'QA OR', gameVersion: 'OR', tid: 0, sid: 0, shinyCharm: false },
                   { id: 'qa-as', name: 'QA AS', gameVersion: 'AS', tid: 0, sid: 0, shinyCharm: false },
                   { id: 'qa-y', name: 'QA Y', gameVersion: 'Y', tid: 0, sid: 0, shinyCharm: false },
                   { id: 'qa-nav', name: 'QA DexNav', gameVersion: 'AS', tid: 30733, sid: 0, shinyCharm: true }]
    }))""")
    button(page, re.compile("Generation 6")).click()
    page.get_by_label("MT seed (hex)", exact=True).fill("35B19AF2")
    button(page, "Apply").click()
    test_card_imports(page)
    print("WC6/WC6full, manual entry, invalid uploads and focus passed", flush=True)
    test_stationary_timeline(page, "X", 2)
    select_profile(page, "qa-or")
    test_stationary_timeline(page, "OR", 158)
    print("Calibrated Mewtwo and Regirock match the v1.0.6 vectors in the browser", flush=True)
    select_profile(page, "qa-x")
    test_wild_profile_switch(page)
    print("Wild methods reset on XY/ORAS profile changes", flush=True)
    test_finder_cancellation(page)
    print("Four-worker Finder stops and the next search returns the known seed", flush=True)
    test_egg_key_transfer(page)
    print("Egg key transfer preserves word order and the current egg EC", flush=True)
    test_radar_zones_and_encounter(page)
    print("PokéRadar map, all five zones and forced shiny encounter match the reference", flush=True)
    test_dexnav_routes(page)
    print("DexNav OR/AS active encounter and missed step match the C# reference", flush=True)
    test_dexnav_forced_shiny(page)
    print("DexNav forced shiny PID, EC, IVs and hidden ability match the composed reference", flush=True)
    test_your_id_event_egg(page)
    print("WC6full Event egg and OT metadata match the reference on all four games", flush=True)
    browser.close()

