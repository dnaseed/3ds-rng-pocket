<div align="center">
  <img src="public/icons/icon-192.png" alt="3DS RNG Pocket" width="96" height="96" />
  <h1>3DS RNG Pocket</h1>
  <p>An independent mobile-first port of 3DSRNGTool for Pokémon X, Y, Omega Ruby, Alpha Sapphire, Sun, Moon, Ultra Sun &amp; Ultra Moon. Find your target frame on your phone while playing on your Nintendo 3DS.</p>
  <p><a href="https://dnaseed.github.io/3ds-rng-pocket/"><strong>Open 3DS RNG Pocket</strong></a></p>
</div>

**Frame searches work offline after the first load.** The on-demand PokeReader scanner also runs 100% locally on your device and works offline once warmed up online. Gen 7 Save/ID clock seed lookup requires an internet connection when you submit the sequence; if you already know your initial seed (or use the QR Scanner), everything runs offline. Gen 6 tools run 100% offline.

## Quick RNG workflow

### Generation 6 (X, Y, Omega Ruby & Alpha Sapphire)

1. Tap **Open Gen 6** (tap **EN** on the home screen or inside **Trainer Profiles** to switch to Italian). Go to **More → Trainer Profiles → New Profile** to set your game version, TID/SID, and Shiny Charm.
2. In **Seed**, enter your 32-bit **MT Seed (hex)**, tap **Scan overlay** ([How to use Scan overlay](#scan-overlay-for-pokereader) — *PokeReader CFW users only*) to read a PokeReader screen (`MT Seed`, `MT Advances`, `TinyMT S3–S0`, or Daycare `Egg Key`), or use **MT Seed Finder** (1 capture with IV ranges + nature, or 2 captures with exact IVs across 1/2/4 workers). Use **TinyMT Timeline** to calibrate blinks, fidgets, weather, or encounter slots from your `S3–S0` TinyMT state.
3. Open **Stationary**, **Wild** (Normal, Fishing, Rock Smash, Cave Shadows, Trap, Friend Safari, Hordes, PokéRadar, or DexNav), **Egg**, **More → Event** (`.wc6`/`.wc6full` or manual), **More → ID RNG**, or **More → Tools (Pokérus)**, apply frame filters, and tap **Search**.

### Generation 7 (Sun, Moon, Ultra Sun & Ultra Moon)

1. Tap **Open Gen 7** to start on **Seed** with an Ultra Sun profile (switch or add profiles in **More → Trainer Profiles**). Enter your initial seed in hex, tap **Scan overlay** ([How to use Scan overlay](#scan-overlay-for-pokereader) — *PokeReader CFW users only*) to extract `Initial Seed`, `Advances`, or `Egg Seed`, or tap **Use camera** ([How to use the camera](#use-camera-for-stock-3ds-clocks)) on a stock 3DS/2DS without CFW.
2. In **Stationary**, **Wild**, or **More → Event**, choose your encounter and select **Normal**. Set **Min Frame** and **Max Frame**, choose your filters, and tap **Search**. With NPCs present, **Safe Frames Only** helps find a stable starting frame.
3. Tap a result. **Timeline from #…** opens a populated Timeline starting at that frame to read the wait time. Use **Set Min Frame** or **Set Target** when you only want to save the frame number.
4. If you miss the encounter, open the intended frame and tap **Around Target (±100F)**. Use **Filters → Calculate IVs from stats** to turn a caught Pokémon’s summary stats (0 EVs) into IV ranges and compare nearby results. The **?** beside the result count explains the frame badges.

## Features

### Generation 6 (X · Y · OR · AS)
- **Seed, MT Seed Finder & TinyMT Timeline.** Enter a known 32-bit `MT19937` seed, estimate frame-to-time wait, find your seed from 1 or 2 captures (with Gen 6 base-stat IV Calculator and 1/2/4 Web Workers), or calibrate `TinyMT` timelines (`S3–S0`) for blinks, flying, weather, IDs, fishing, Rock Smash, hordes, Friend Safari, and PokéRadar.
- **Stationary & Poké Transporter.** Search legendaries, starters, fossils, in-game gifts/trades, Pokémon Link, and Poké Transporter sequences with delay, Shiny Charm, Synchronize, and optional TinyMT Timeline integration.
- **Wild, Hordes, PokéRadar & DexNav.** Search Normal Wild, Fishing (all 3 rods), Rock Smash, Cave Shadows, Trap, Friend Safari, **Hordes** (all 5 members in order with HA/held-item/flute details), **PokéRadar (XY)** (9×9 patch map, music, shiny and overlap zones), and **DexNav (ORAS)** (active search and step trigger, Search Level, chain length, egg move, potential, held item, and forced shiny).
- **Egg RNG.** Preview the current egg from `Key0`/`Key1`, search **Egg RNG** and **Main RNG Egg** frames with full-range filters, parent inheritance, Everstone, Destiny Knot, Power Items, Masuda Method, and Shiny Charm.
- **Event, ID RNG & Pokérus.** Import `.wc6` / `.wc6full` Wonder Cards or configure event locks manually with full-range filtering, search Trainer ID/SID/TSV/TRV from a TinyMT state, or find Pokérus infection frames and strains.
- **Gen 6 Profiles & IV Calculator.** Isolated Gen 6 profile/session storage (`generation: 6` JSON export/import) and Gen 6 personal base stats for IV-from-stats calculation.

### Generation 7 (US · UM · S · M)
- **Seed and timing.** Read clock hands using vector dials or 3DS sprites. With a known seed, enter the hand positions you see in the **3DS QR Scanner** to find your current frame offline. Use the **Time Calculator** to estimate the wait between two frames.
- **Stationary.** Search legendary, Ultra Beast, gift, trade, and Poké Pelago encounters. Model encounter delays, NPCs, rain, and fidget animations with Timeline and Timeline Leap.
- **Wild, fishing, and SOS.** Choose the location, time of day, and lead ability. Use Fishy Timeline for fishing or set the caller, chain length, weather, and SOS seed for ally encounters.
- **Egg.** Search egg frames, follow the **Shortest Path** Accept/Reject checklist, recover an egg seed with **127 Magikarp**, or use **Main RNG Egg** to calculate the PID.
- **Event and Trainer ID.** Import Mystery Gifts from `.wc7` or `.wc7full` files, configure event locks, or search trainer IDs with a clock-hand preview.
- **Misc RNG Tool.** Open **Tools** on desktop or **More → Tools** on mobile to search for Pokérus, Festival Plaza facilities, Battle Tree trainers, Roto Loto powers, and berries by location.
- **Trainer profiles.** Save profiles for each game, import or export them as JSON, and switch between English and Italian.

## Assisted acquisition (camera & overlay OCR)

Pocket includes two optional acquisition helpers so you don’t have to transcribe long hex seeds or read fast clock hands by eye:

- **Scan overlay** *(for CFW consoles running **PokeReader** only)* automatically reads PokeReader values from a photo and verifies them locally before filling your fields.
- **Use camera** *(for stock 3DS/2DS consoles without CFW)* is a manual camera helper for Gen 7’s fast loading clock: you freeze the video, step back frame by frame, align the reticle, and tap **`+ Add XX`** yourself to record each reading.

### Scan overlay for PokeReader

**Exclusively for users running the PokeReader overlay on a CFW 3DS/2DS.** Instead of manually typing 8-digit hex seeds, `TinyMT` states, or Daycare egg keys, you can scan the console screen in one photo — all processing stays 100% on your device.

1. On your 3DS/2DS, open PokeReader’s **RNG** view (for seed, advances, and Gen 6 `TinyMT` state) or **Daycare** view (for egg seed / egg keys).
2. In Pocket, tap **Scan overlay** (labeled **Overlay** on narrow screens). On first use, open it while online and wait a moment until it finishes preparing — subsequent scans work offline.
3. Tap **Camera** or **Open photo**: Pocket reads the full screen automatically with no manual cropping.
4. Inspect each field’s badge and zoomed crop:
   - **`Verified ✓`** confirms a full mathematical match (`SFMT` in Gen 7; `MT` or full `32/32` `TinyMT` state `S3–S0` in Gen 6).
   - **`Probable`** or **`Unverified`** (and Daycare views) means you should compare the cropped digits and use quick `8↔B` / `0↔D` swaps if needed.
5. Tap **Apply Seed + Frame**, **Apply Egg Seed**, **Apply Egg Key** (`Egg[0] → Key0`, `Egg[1] → Key1`), or **Apply to Timeline / ID RNG** — nothing overwrites your active seed, frame, or profile until you confirm.

### Use camera for stock 3DS clocks

Designed for **Gen 7 players without CFW** who need accurate readings from the brief bottom-screen loading clock in **Save**, **New Game ID**, and **QR Scanner** without trying to eyeball it live.

#### Save Screen (`End · Offset 4`) — step-by-step for your first sequence

1. On your phone, open **Seed → Save → End → Offset 4 → Use camera**. On your 3DS/2DS, boot or Soft Reset to the Title screen (**Press A / Start**) and stay there — the online Save lookup expects your sequence to start from the **very first** Continue screen of that boot.
2. **Capture one reading:** press **A** on the 3DS/2DS to enter **Continue** and watch the bottom-screen loading clock. Right after it finishes, tap **Freeze** on your phone.
3. Scrub the last **30 frames (60 ms steps, ~1.8 s)** back to the **last clear frame where the clock is still visible** (immediately before / as the Trainer portrait starts to appear).
4. Tap **Center reticle** to align the open center ring with the clock hub (drag anywhere on the square so your finger never covers the clock, or use `← ↑ ↓ →`), compare **both** hands — especially the faster `2×` long yellow hand — against the side-by-side `Clock_XX` sprite, and tap **`+ Add XX`** to save the reading.
5. Press **B** on the 3DS/2DS to return to the Title screen (**never Soft Reset** mid-sequence, or your seed will change) and repeat steps 2–4 until you have **at least 8 consecutive readings** (if you already entered Continue once before starting, or miss a reading mid-way, Soft Reset to start a fresh boot). There is no maximum of 8: reopening **Use camera** appends new readings onto your existing sequence so you can easily add a 9th or 10th reading.
6. Tap **Look up seed online** to submit your confirmed sequence once (internet is only needed at this step; zero requests are sent while collecting).

- **Save End (`Offset 4`) tip:** in physical 2DS testing, when the last clear clock frame sits midway between two adjacent close ticks, picking the **next configuration (`+1`)** (unless clearly far away) works best; taking a **9th consecutive reading** helps rule out random seed collisions.
- **Mixing camera & manual readings:** you can save a partial camera draft (`< 8`) straight into the sequence (or choose **Save to sequence** if you close with readings in the draft) and finish the rest manually — or vice versa.
- **Other modes & camera behavior:** **Use camera** also works in **New Game ID** (`Start`, 9 readings) and **QR Scanner** (`Start`, min 2 readings, 100% offline). It requests `1080p` from the rear camera; focus (**Refocus AF**), zoom (`HW` / `Mix` / `Dig`), and rear **Lens** switching depend on your phone. Frozen frames are protected from stray taps, and switching apps pauses the camera while keeping your draft.

## Desktop parity and scope

- **Gen 7:** frame outputs were compared row by row with **3DSRNGTool v1.0.6** on sampled **Ultra Sun** and **Moon** scenarios covering Stationary, Wild, Egg, Event, Trainer ID, and Misc RNG.
- **Gen 6:** outputs were verified against **3DSRNGTool v1.0.6** across MT19937, TinyMT Timeline, Stationary/Transporter, Wild/Fishing/Rock Smash/Shadows/Trap/Friend Safari, Hordes, PokéRadar, Egg, Event (`.wc6`/`.wc6full`), ID RNG, Pokérus, and MT Seed Finder. For **DexNav**, patch/trigger calculations match `DexNav.cs` while Pokémon generation matches the `Wild6` generator of `3DSRNGTool v1.0.6` (the v1.0.6 Windows UI does not expose an integrated DexNav flow).
- **Assisted acquisition scope:** Gen 7 OCR is verified on **Ultra Sun (PokeReader 0.7.4)**; Gen 6 OCR is active for XY/ORAS and verified offline on **ORAS ITA 1.4** (Pokémon X/Y real-photo corpus pending). Hardware testing verified **Clock camera** + **Scan overlay** on **Android Chrome (Galaxy S23) + Nintendo 2DS**, and PWA installation, camera access, and offline execution on **iPadOS Safari** (iPhone Safari compact viewport not yet tested).

## Use online or install on a phone

You can use [3DS RNG Pocket](https://dnaseed.github.io/3ds-rng-pocket/) directly in any mobile or desktop browser with no local setup. At widths of 1024 px and above, the top navigation opens all eight sections directly. Search settings and results appear side by side, so you can adjust an encounter while keeping the previous frames in view.

To install it as an offline PWA on your phone, open the same link in your mobile browser: on Android, choose **Install app** or **Add to Home screen** from the browser menu; on iOS Safari, tap **Share → Add to Home Screen**.

## Local development

Only needed if you want to run, test, or modify the source code locally (requires a current Node.js 22.x release):

```bash
npm ci
npm run dev
```

To run checks or preview the installable production build:

```bash
npm run typecheck
npm test           # Run the automated Vitest suite
npm run build      # Generate dist/
npm run preview    # Serve dist/ locally
```

## Reporting a mismatch

Use [GitHub Issues](https://github.com/dnaseed/3ds-rng-pocket/issues) to report a mismatch. Include the **game version**, **seed** (egg seed / TinyMT state where applicable), **RNG mode and frame**, and the **expected and actual values**. For a desktop comparison, include the encounter settings so someone can reproduce the same row.

## Credits and license

The Gen 6 and Gen 7 engines and research come from **wwwwwwzx** and the contributors to [3DSRNGTool](https://github.com/wwwwwwzx/3DSRNGTool). Gen 7 Save/ID clock lookups use **odanado**’s [initial seed API](https://github.com/odanado/rng-api).

3DS RNG Pocket is a fan-made project released under the [MIT License](LICENSE). The ported generators also carry the upstream [MT19937](public/licenses/MT.txt), [SFMT](public/licenses/SFMT.txt), [SFMT C#](public/licenses/SFMT_CS.txt), and [TinyMT](public/licenses/TinyMT.txt) notices.

3DS RNG Pocket is unaffiliated with Nintendo, Game Freak, Creatures Inc., and The Pokémon Company.
