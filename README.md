#
# EES — Epstein Emails Explorer

```
███████╗██████╗ ███████╗████████╗██████╗ ███████╗██╗███╗   ██╗
██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║████╗  ██║
███████╗██████╔╝█████╗     ██║   ██████╔╝█████╗  ██║██╔██╗ ██║
╚════██║██╔══██╗██╔══╝     ██║   ██╔══██╗██╔══╝  ██║██║╚██╗██║
███████║██║  ██║███████╗   ██║   ██║  ██║███████╗██║██║ ╚████║
╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝

███████╗███╗   ███╗ █████╗ ██╗██╗     ███████╗
██╔════╝████╗ ████║██╔══██╗██║██║     ██╔════╝
███████╗██╔████╔██║███████║██║██║     █████╗  
╚════██║██║╚██╔╝██║██╔══██║██║██║     ██╔══╝  
███████║██║ ╚═╝ ██║██║  ██║██║███████╗███████╗
╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝
```

Welcome to **EES** — the unapologetically slick, client‑side, zero‑backend way to slice, dice, and spelunk the notorious Epstein email corpus. Think “data forensics meets premium fintech polish,” but for FOIA drop‑box archaeology.

## 🎨 Why it feels premium
- **Glass & glow**: Gradient hero, stat tiles, pill toggles, and neon hover cues tuned for that “Stripe, but for evidence” vibe.
- **Space Grotesk everywhere**: Modern typography that makes even plaintext headers look boardroom‑ready.
- **Kinetic feedback**: Centered loading veil, real‑time result counts, and smooth selection halos keep you oriented while you dig.

## 🧠 Under the hood
- **Single-file datastore**: `data/epstein.sqlite` (~69 MB) ships everything (meta, timeline, people, threads, text chunks) in one efficient bundle.
- **All in the worker**: `search-worker.js` loads SQLite via sql.js, decompresses with pako, builds a FlexSearch index, and streams text on demand — no server calls, no tracking beacons.
- **Fielded search DSL**: `subject:`, `from:`, `to:`, `body:`, boolean `AND/OR/NOT`, and date ranges like `date:[2001-01-01 TO 2005-12-31]` — exactly what you need for precision sleuthing.
- **People & threads**: Reconstructed threads, co-participant stats, domains, and quick “view whole thread” actions right in the UI.
- **Timeline at a glance**: Mini histogram to timebox your hunts without leaving the pane.

## 🚀 Using it
1) Open https://dicklesworthstone.github.io/ees/
2) Wait a moment while the worker hydrates the index (watch the centered spinner).
3) Start querying — mix fields and boolean ops, then refine with filename, date, and kind filters.
4) Click any result to read the chunk; hop chunks, stitch full messages, or view entire threads inline.

## 📦 Local dev
```bash
uv run build_epstein_index.py   # rebuild the sqlite bundle
./deploy_gh_pages.sh            # stage + push gh-pages (ships index.html, worker, vendor, sqlite)
```

## 🔒 Privacy & footprint
- No backend calls beyond fetching the shipped assets; everything indexes in your browser/worker.
- Vendored `flexsearch`, `pako`, `sql.js` served locally for reliability.

## 🧭 Roadmap (a.k.a. “nice-to-haves if we ever sleep”)
- Smarter relevance tuning and highlighting.
- Offline caching of the sqlite bundle.
- Optional LFS shrink wrap to hush the 50 MB warning while staying under 100 MB.

## ✨ One-liner
EES is the luxe, zero-server, FOIA spelunker for people who want elite tooling to navigate sordid inbox history — fast, private, and undeniably shiny.
