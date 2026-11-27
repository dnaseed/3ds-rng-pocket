<div align="center">
  <img src="public/icons/icon-192.png" alt="3DS RNG Pocket" width="96" height="96" />
  <h1>3DS RNG Pocket</h1>
  <p>An independent mobile-first port of 3DSRNGTool for Pokémon X, Y, Omega Ruby, Alpha Sapphire, Sun, Moon, Ultra Sun &amp; Ultra Moon. Find your target frame on your phone while playing on your Nintendo 3DS.</p>
  <p><a href="https://dnaseed.github.io/3ds-rng-pocket/"><strong>Open 3DS RNG Pocket</strong></a></p>
</div>

**Frame searches work offline after the first load.** The on-demand PokeReader OCR engine also runs 100% locally on your device and works offline once warmed up by opening **Scan overlay** while online. Gen 7 Save/ID clock seed lookup requires an internet connection when you submit the sequence; if you already know your initial seed (or use the QR Scanner), everything runs offline. Gen 6 tools run 100% offline.

## Quick RNG workflow

### Generation 6 (X, Y, Omega Ruby & Alpha Sapphire)

1. Tap **Open Gen 6** (tap **EN** on the home screen or inside **Trainer Profiles** to switch to Italian). Go to **More → Trainer Profiles → New Profile** to set your game version, TID/SID, and Shiny Charm.
2. In **Seed**, enter your 32-bit **MT Seed (hex)**, tap **Scan overlay** to read a PokeReader screen (`MT Seed`, `MT Advances`, `TinyMT S3–S0`, or Daycare `Egg Key` in Seed, TinyMT Timeline, ID RNG, or Egg), or use **MT Seed Finder** (1 capture with IV ranges + nature, or 2 captures with exact IVs across 1/2/4 workers). Use **TinyMT Timeline** to calibrate blinks, fidgets, weather, or encounter slots from your `S3–S0` TinyMT state.
3. Open **Stationary**, **Wild** (Normal, Fishing, Rock Smash, Cave Shadows, Trap, Friend Safari, Hordes, PokéRadar, or DexNav), **Egg**, **More → Event** (`.wc6`/`.wc6full` or manual), **More → ID RNG**, or **More → Tools (Pokérus)**, apply frame filters, and tap **Search**.

### Generation 7 (Sun, Moon, Ultra Sun & Ultra Moon)

1. Tap **Open Gen 7** to start on **Seed** with an Ultra Sun profile (switch or add profiles in **More → Trainer Profiles**). Enter your initial seed in hex, tap **Scan overlay** to read a PokeReader screen (`Initial Seed`, `Advances`, or `Egg Seed`), or tap **Use camera** for stock 3DS/2DS clock readings.
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

### PokeReader Overlay Scanner (`Scan overlay` — Gen 7 & Gen 6)
Read PokeReader directly from full-screen photos of your console without manual cropping. All image processing and OCR run **100% locally on your device** (no photos leave the browser). The self-hosted OCR engine (`tesseract.js`, WASM core, and English model) is cached on demand into `pocket-ocr-v1` when you first open the scanner online, so later scans work offline too.

- **Gen 7** *(tested on Ultra Sun · PokeReader 0.7.4)*: extracts `Initial Seed` and `Advances` with mathematical **`SFMT Verified ✓`** checking against `State[1]` / `State[0]`, plus `Egg Seed` (`Egg[3..0]`).
- **Gen 6** *(active on X/Y/OR/AS; tested on ORAS ITA 1.4)*: extracts `MT Seed` and `MT Advances` with **`MT Verified ✓`** against `Curr state`, recovers and verifies the full 128-bit `TinyMT` state `S3–S0` (**`TinyMT Verified ✓`** from `Tiny u32 seed` + `Advances`), and maps Daycare `Egg[0] → Key0` and `Egg[1] → Key1`.
- **Visual verification & safe apply:** zoomed crops for each hex field and quick `8↔B` / `0↔D` ambiguity swaps appear before transfer; nothing overwrites your current seed, frame, or profile until you tap **Apply Seed + Frame**, **Apply Egg Seed**, or **Apply Egg Key**.

### Gen 7 Clock Camera Helper (`Use camera` — stock 3DS/2DS)
Acquire clock-hand readings without CFW using your phone's rear camera across **Save** (`End` with default `Offset 4`, or `Start`), **New Game ID** (`Start`, 9 readings), and **QR Scanner** (`Start`, min 2 readings, 100% offline).

1. **Game loop on 3DS/2DS (Save Screen · `End`, `Offset 4`):** boot the game to the Title screen (**Press A / Start**) — this fixes your initial seed. Press **A** to enter **Continue**, watch the bottom-screen loading clock spin, then press **B** to back out to the Title screen (**never Soft Reset**, which changes the seed). Repeat **8 consecutive times**. If you miss a clock, tap **Clear** in the camera draft and collect 8 fresh consecutive readings on the same boot; taking a **9th consecutive reading** helps rule out random seed collisions.
2. **Freeze & micro-scrub:** tap **Freeze** right after the animation finishes to scrub the last **30 frames at 60 ms intervals (~1.8 s)** with relative time offsets (`-0.xx s`). Pick the **last clear frame available where the clock is still visible** (immediately before / as the Trainer portrait begins to appear).
3. **Align & choose the tick:** tap **Center reticle** to align the open center ring with the 2DS clock hub using relative drag from anywhere on the viewfinder (your finger stays out of the way) or the fine **`← ↑ ↓ →`** nudge buttons. Compare both hands — especially the faster **`2×` long yellow hand** — against the side-by-side game sprite (`Clock_XX`). **When unsure between two adjacent close configurations, choose the next configuration (`+1`)** (unless clearly far away) while keeping `Offset 4` for Save End.
4. **Camera & privacy safeguards:** runs at `1920×1080` on the rear camera with continuous autofocus, a manual **Refocus AF** kick button, persistent rear **Lens** selector (`localStorage`), and `HW` / `Mix` / `Dig` zoom indicator. Frozen frames are protected against stray taps; switching apps pauses the camera while preserving your draft; closing with `X` leaves your manual sequence untouched; and zero network requests are sent until **Look up seed online** is explicitly pressed.

## Desktop parity and scope

- **Gen 7:** frame outputs were compared row by row with **3DSRNGTool v1.0.6** on sampled **Ultra Sun** and **Moon** scenarios covering Stationary, Wild, Egg, Event, Trainer ID, and Misc RNG.
- **Gen 6:** outputs were verified against **3DSRNGTool v1.0.6** across MT19937, TinyMT Timeline, Stationary/Transporter, Wild/Fishing/Rock Smash/Shadows/Trap/Friend Safari, Hordes, PokéRadar, Egg, Event (`.wc6`/`.wc6full`), ID RNG, Pokérus, and MT Seed Finder. For **DexNav**, patch/trigger calculations match `DexNav.cs` while Pokémon generation matches the `Wild6` generator of `3DSRNGTool v1.0.6` (the v1.0.6 Windows UI does not expose an integrated DexNav flow).
- **Assisted acquisition scope:** Gen 7 OCR is verified on **Ultra Sun (PokeReader 0.7.4)**; Gen 6 OCR is active for XY/ORAS and verified offline on **ORAS ITA 1.4** (Pokémon X/Y real-photo corpus pending). Both **Clock camera** (Save End against PokeReader seed, QR offline) and **Scan overlay** were verified on real **Android Chrome + Nintendo 2DS** hardware; iOS Safari remains unverified on physical hardware.

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
