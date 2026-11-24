<div align="center">
  <img src="public/icons/icon-192.png" alt="3DS RNG Pocket" width="96" height="96" />
  <h1>3DS RNG Pocket</h1>
  <p>An independent mobile-first port of 3DSRNGTool for Pokémon Sun, Moon, Ultra Sun &amp; Ultra Moon. Find your target frame on your phone while playing on your Nintendo 3DS.</p>
  <p><a href="https://dnaseed.github.io/3ds-rng-pocket/"><strong>Open 3DS RNG Pocket</strong></a></p>
</div>

**Frame searches work offline after the first load.** Save/ID clock seed lookup requires an internet connection. If you already know your initial seed, enter it in hex to work offline.

## Quick Gen 7 RNG workflow

1. For English, tap **IT** on the home screen. **Open Gen 7** starts on **Seed** with an Ultra Sun profile. For another game, go to **More → Trainer Profiles → New Profile**, choose the game, save, and return to **Seed**. Enter your initial seed or use the Save Screen clock lookup.
2. In **Stationary**, **Wild**, or **More → Event**, choose your encounter and select **Normal**. Set **Min Frame** and **Max Frame**, choose your filters, and tap **Search**. With NPCs present, **Safe Frames Only** helps find a stable starting frame.
3. Tap a result. **Timeline from #…** opens a populated Timeline starting at that frame. Read the waiting time there. Use **Set Min Frame** or **Set Target** when you only want to save the frame number.
4. If you miss the encounter, open the intended frame and tap **Around Target (±100F)**. Use **Filters → Calculate IVs from stats** to turn a caught Pokémon’s summary stats (0 EVs) into IV ranges and compare nearby results. The **?** beside the result count explains the frame badges.

## Features

- **Seed and timing.** Read clock hands using vector dials or 3DS sprites. With a known seed, enter the hand positions you see in the **3DS QR Scanner** to find your current frame offline. Use the **Time Calculator** to estimate the wait between two frames.
- **Stationary.** Search legendary, Ultra Beast, gift, trade, and Poké Pelago encounters. Model encounter delays, NPCs, rain, and fidget animations with Timeline and Timeline Leap.
- **Wild, fishing, and SOS.** Choose the location, time of day, and lead ability. Use Fishy Timeline for fishing or set the caller, chain length, weather, and SOS seed for ally encounters.
- **Egg.** Search egg frames, follow the **Shortest Path** Accept/Reject checklist, recover an egg seed with **127 Magikarp**, or use **Main RNG Egg** to calculate the PID.
- **Event and Trainer ID.** Import Mystery Gifts from `.wc7` or `.wc7full` files, configure event locks, or search trainer IDs with a clock-hand preview.
- **Trainer profiles.** Save profiles for each game, import or export them as JSON, and switch between English and Italian.
- **Misc RNG Tool.** Open **Tools** on desktop or **More → Tools** on mobile to search for Pokérus, Festival Plaza facilities, Battle Tree trainers, Roto Loto powers, and berries by location.

## Desktop parity and scope

Gen 7 frame outputs were compared row by row with **3DSRNGTool v1.0.6** on sampled **Ultra Sun** and **Moon** scenarios covering Stationary, Wild, Egg, Event, and Trainer ID RNG.

Clock readings and frame advances are entered manually. Planned additions include Gen 6 (X/Y and Omega Ruby/Alpha Sapphire) and optional console integration.

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

Use [GitHub Issues](https://github.com/dnaseed/3ds-rng-pocket/issues) to report a mismatch. Include the **game version**, **seed** (egg seed for breeding), **RNG mode and frame**, and the **expected and actual values**. For a desktop comparison, include the encounter settings so someone can reproduce the same row.

## Credits and license

The Gen 7 engine and research come from **wwwwwwzx** and the contributors to [3DSRNGTool](https://github.com/wwwwwwzx/3DSRNGTool). Save/ID clock lookups use **odanado**’s [initial seed API](https://github.com/odanado/rng-api).

3DS RNG Pocket is a fan-made project released under the [MIT License](LICENSE). The ported generators also carry the upstream [SFMT](public/licenses/SFMT.txt), [SFMT C#](public/licenses/SFMT_CS.txt), and [TinyMT](public/licenses/TinyMT.txt) notices.

3DS RNG Pocket is unaffiliated with Nintendo, Game Freak, Creatures Inc., and The Pokémon Company.
