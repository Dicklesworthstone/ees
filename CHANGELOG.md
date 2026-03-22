# Changelog

All notable changes to **EES** (Epstein Emails Search) are documented here.

This project uses no formal release tags. The changelog is organized by
**capability area** rather than chronological diff order, so readers can find
what matters to them. Every entry links to the live commit on GitHub.

Repository: <https://github.com/Dicklesworthstone/ees>
Live site: <https://dicklesworthstone.github.io/ees/>

---

## Search Engine & Data Architecture

The core of EES: a client-side SQLite database, FlexSearch full-text engine,
and a two-stage indexing strategy that keeps first paint fast while building
a complete index in the background.

### SQLite-in-browser engine

- **Ship sqlite-backed search with vendored assets**
  [`f175749`](https://github.com/Dicklesworthstone/ees/commit/f1757496787e1cb62848df28b4014e02755b076e)
  (2025-11-21) -- The pivotal architectural commit. Replaced the original
  JSON + doc-fetch pipeline with sql.js (SQLite compiled to WASM) running
  inside a Web Worker. Vendored `sql.js 1.11.0`, `flexsearch`, and `pako`
  locally (previously CDN). Main thread initializes from worker-provided
  docs/people/timeline and routes all search and text requests via
  `postMessage` channels. Added `package-lock.json` and `uv.lock` for
  reproducible installs.

### Hot/cold data split

- **Hot/cold split, Brotli text pack, true LRU**
  [`0853843`](https://github.com/Dicklesworthstone/ees/commit/0853843d3810bb8088ef5dd2e3c7a846161bbd36)
  (2025-11-21) -- Split the monolithic `epstein.sqlite` (~69 MB) into
  `meta.sqlite` (subjects, participants, dates, previews, offsets -- small
  and fast to load) plus `text.pack` (compressed body chunks addressed by
  offset/length). Worker fetches both, decompresses body text on demand.

- **Meta/text split build pipeline adjustment**
  [`6636173`](https://github.com/Dicklesworthstone/ees/commit/6636173b8977ebcc79737cb4d9b06b81fb2c4fd1)
  (2025-11-21) -- Build fix for the meta/text split; added Brotli dependency
  to `uv.lock`.

### Lite-first indexing & on-demand text

- **Fast startup with lite index + on-demand text**
  [`17a5ec4`](https://github.com/Dicklesworthstone/ees/commit/17a5ec470a217e1821fa6744a1282422004c08ff)
  (2025-11-21) -- Worker instantly builds a lite index
  (subject/from/to/preview/domains) so search is usable within seconds.
  Full-text index builds silently in the background and swaps in when ready.
  Body text stays in `text.pack`; the worker inflates only what the user
  opens, backed by an LRU cache.

- **Clear term cache when full index arrives**
  [`b44ea46`](https://github.com/Dicklesworthstone/ees/commit/b44ea46c4fb64f6d91d35e1dbe66ca610665af34)
  (2025-11-21) -- Avoids stale search hits by clearing cached term results
  and bumping a generation counter on full-index-ready.

- **True LRU text cache + id-map full index**
  [`0f79890`](https://github.com/Dicklesworthstone/ees/commit/0f79890414c8b41a40f2e56ffd50bdb821881218)
  (2025-11-21) -- Map-based LRU (delete-on-hit + re-insert) with 200-entry
  cap. Full index built via `id->meta` map instead of assuming contiguous
  IDs; more frequent yields during build.

---

## Compression Pipeline (Brotli to Zlib Migration)

The text pack was originally compressed with Brotli via fflate. Browser
compatibility issues (fflate UMD loading failures in Web Workers) prompted
a migration to zlib via pako, which loads cleanly in all environments.

- **Switch from Brotli to Zlib**
  [`62fe07f`](https://github.com/Dicklesworthstone/ees/commit/62fe07f3ba2032a5cbc757dba6cda1f7ce32f004)
  (2025-11-21) -- Changed `build_epstein_index.py` to use zlib level-9
  compression; updated `search-worker.js` to decompress with `pako.inflate`
  instead of `fflate.brotliDecompress`; removed Brotli from `pyproject.toml`.

- **Use browser-safe fflate bundle**
  [`0fdf49b`](https://github.com/Dicklesworthstone/ees/commit/0fdf49b483d1af0dbafc2cd38d0c41de546962d1)
  (2025-11-21) -- Added `vendor/fflate.min.js` (browser UMD build) as an
  intermediate fix before the full switch to pako.

---

## Web Worker UMD Module Loading

A series of iterative fixes to get UMD-bundled libraries (FlexSearch, pako,
fflate) loading correctly inside a Web Worker, where `module`, `exports`,
and `require` do not exist natively. Listed from final resolution backward.

- **Ultimate fix: explicit UMD isolation**
  [`1b9df04`](https://github.com/Dicklesworthstone/ees/commit/1b9df042032615779a43726e4d9a09b1467a9672)
  (2025-11-21) -- Removed global `exports`/`module` polyfills entirely.
  Each library loaded in isolation with per-library polyfill setup and
  teardown. This was the definitive resolution.

- **Fix dependency loading order**
  [`d755f99`](https://github.com/Dicklesworthstone/ees/commit/d755f991defafdb36359708dd1b099d738b370d5)
  (2025-11-21) -- Load FlexSearch first (needs clean global scope), then
  set up CommonJS polyfills for subsequent libraries.

- **Reset exports between UMD module loads**
  [`e122f89`](https://github.com/Dicklesworthstone/ees/commit/e122f898987a31476675c4fa81d875314b3c6adc)
  (2025-11-21) -- Refactored worker to reset `exports`/`module.exports`
  between each `importScripts` call.

- **Robustify pako loading in worker**
  [`0139974`](https://github.com/Dicklesworthstone/ees/commit/013997488a0bc3df5cc5a5755f70f18517ba8e0f)
  (2025-11-21) -- Added fallback checks for pako attachment to `self`.

- **Fix FlexSearch loading and suppress HF warnings**
  [`1b0a646`](https://github.com/Dicklesworthstone/ees/commit/1b0a6464666df945731e8ba8b58cb7def8a117d6)
  (2025-11-21) -- FlexSearch detection fix; suppressed Hugging Face dataset
  download warnings in builder.

- **Getter/setter to synchronize exports and module.exports**
  [`e82d9fd`](https://github.com/Dicklesworthstone/ees/commit/e82d9fd39ab8fec8b5e23af530eba6f817950f22)
  (2025-11-21) -- Used `Object.defineProperty` so that when fflate's UMD
  wrapper sets `module.exports = lib`, internal `exports.foo = bar`
  assignments land on the same object.

- **Initialize module.exports + fflate debugging**
  [`f3c692e`](https://github.com/Dicklesworthstone/ees/commit/f3c692e001cc1a4b65b6bc1d2d3bcbe192e0d51b)
  (2025-11-21) -- Added validation and diagnostic logging for fflate
  extraction.

- **Load fflate separately with proper polyfills**
  [`9d2ab1e`](https://github.com/Dicklesworthstone/ees/commit/9d2ab1e005a5b10cb115eb666c85b7a97ac9bbb7)
  (2025-11-21) -- Two-phase loading: libraries that work without polyfills
  first, then polyfill `exports` and `module` for fflate only.

- **Only polyfill exports, not module**
  [`77110bc`](https://github.com/Dicklesworthstone/ees/commit/77110bc17d325c8cc2fc4456d47dd9e056289a19)
  (2025-11-21) -- Discovered that polyfilling `module` caused all UMD libs
  to take the CommonJS path, each overwriting `module.exports` (last writer
  wins, all others lost).

- **Add initial exports polyfill for UMD in worker**
  [`b74373b`](https://github.com/Dicklesworthstone/ees/commit/b74373bf5c3b8301a4ccadc7346fce6374b07609)
  (2025-11-21) -- First attempt at solving
  `ReferenceError: exports is not defined`.

---

## Data Quality & Body Sanitization

Improvements to the Python build pipeline (`build_epstein_index.py`) that
clean up email body text, reconstruct subjects, and improve thread accuracy.

- **Cleaner bodies and subject fallbacks**
  [`6f1ee26`](https://github.com/Dicklesworthstone/ees/commit/6f1ee26c04b222637a59b2b344d6b921d17547a0)
  (2025-11-21) -- Unwrap soft line wraps, collapse excess blank lines before
  chunking. Extract subjects heuristically; fall back to filename when
  missing. Sample 50 chunks during build for formatting quality stats.

- **Noisy-body sanitizer + subject fallback**
  [`1202b8a`](https://github.com/Dicklesworthstone/ees/commit/1202b8a3fc98ef958e931f52b12a09c36324869d)
  (2025-11-21) -- Non-word-character density analysis strips garbled /
  binary-encoded bodies; filename-based subject fallback when header is
  missing.

- **QA: sanitize noisy bodies, subject fallback, strict equality**
  [`05fcc64`](https://github.com/Dicklesworthstone/ees/commit/05fcc648ab8e5241d254bff0abac56c1b8b811e6)
  (2025-11-21) -- Tightened sanitization thresholds; switched to strict
  equality in worker comparisons.

- **Fix three bugs in build_epstein_index.py**
  [`8b2c640`](https://github.com/Dicklesworthstone/ees/commit/8b2c640fbdcad012007cfedca2eb37cbb313ba0d)
  (2025-11-21) -- (1) Removed redundant timezone no-op. (2) Fixed reservoir
  sampling off-by-one (`randint(0, doc_id_seq)` should be
  `randint(0, doc_id_seq-1)`). (3) Enhanced subject normalization to strip
  *all* `Re:`/`Fw:` prefixes, not just the first, significantly improving
  email thread reconstruction.

- **Hard-wrap long lines in body sanitizer**
  [`2786a12`](https://github.com/Dicklesworthstone/ees/commit/2786a12a47227f3a2931c274e71fad7af3a6f6dd)
  (2025-11-21) -- Lines longer than 160 characters are wrapped at word
  boundaries for readable display.

---

## User Interface

### Premium redesign (desktop)

Complete visual overhaul transforming the initial functional interface into
a glassmorphism-styled explorer with Space Grotesk typography, gradient
chips, and stat tiles.

- **Enhance UI with modern design elements**
  [`ac17039`](https://github.com/Dicklesworthstone/ees/commit/ac17039a5aec72583c84d55fdbae67741e794ed1)
  (2025-11-20) -- Glassmorphism effects, gradient backgrounds, CSS custom
  properties for theming, improved loading overlay with dynamic spinner,
  accessibility focus states, skeleton loading animations, custom
  scrollbars.

- **Premium explorer interface**
  [`b7dd4e2`](https://github.com/Dicklesworthstone/ees/commit/b7dd4e27ed6b61ba7c820de0f21e1f65926c3928)
  (2025-11-21) -- Glassmorphism header, gradient chips, stats tiles
  (doc count, people count, date span), pill mode toggle, elevated search
  bar with affordances, modern filter block (filename, date range, kinds),
  highlighted timeline, carded results list with hover/selection cues.

- **Clean stats code, add inline favicon**
  [`2a2d86c`](https://github.com/Dicklesworthstone/ees/commit/2a2d86cf2de2902ed8393e8227bd27c2c5e298bd)
  (2025-11-21) -- Fixed stray literal characters that broke `renderStats`;
  added data-URI favicon.

- **Center loading overlay**
  [`593a5ab`](https://github.com/Dicklesworthstone/ees/commit/593a5abbbba798bdd775418340098d172d56528d)
  (2025-11-21) -- Flexbox centering for the loading spinner and status text.

### Mobile UI/UX overhaul

Transformed the desktop-only explorer into a fully responsive, mobile-first
application with native-app-like navigation.

- **Master-detail animations, sticky headers, swipe-to-back**
  [`643aff0`](https://github.com/Dicklesworthstone/ees/commit/643aff0e2392b34888a626b38a910c38ed412562)
  (2025-11-21) -- Full slide-animation master-detail pattern for
  phones/tablets; swipe right from left edge to go back; sticky detail
  header; horizontal stats card scroll with snap points; filter badge
  system; iOS safe-area inset support; landscape mode optimizations.
  (+646/-37 in explorer HTML.)

- **Sticky detail header, cleaner toggles, better master-detail nav**
  [`fbc75b7`](https://github.com/Dicklesworthstone/ees/commit/fbc75b743ce79cf32a41f4479dc2fdeb04470ec8)
  (2025-11-21) -- Refined toggle controls and sticky positioning for the
  detail pane header bar.

- **Optimized startup + mobile master-detail view**
  [`211f088`](https://github.com/Dicklesworthstone/ees/commit/211f0887251486b139429a0f5173b458abbc2ab4)
  (2025-11-21) -- Unified startup optimization with mobile master-detail
  layout across both `epstein_emails_explorer.html` and
  `search-worker.js`.

- **Fix scroll position on detail view, clear selection on mobile back**
  [`52b5b05`](https://github.com/Dicklesworthstone/ees/commit/52b5b053c9cafa2af003eb4d05bf2af97ca6cf0e)
  (2025-11-21) -- Detail view scrolls to top on open; tapping mobile back
  button clears the current selection.

---

## Build & Deploy Tooling

- **Initial deploy script and build pipeline**
  [`e08d4c5`](https://github.com/Dicklesworthstone/ees/commit/e08d4c596afa2bffc177d6fe94077100c44da1b3)
  (2025-11-20) -- `build_epstein_index.py` processes the Epstein email
  corpus from Hugging Face Datasets, parses and chunks email bodies, and
  builds a SQLite index with people, threads, and timeline tables.
  `deploy_gh_pages.sh` automates deployment to GitHub Pages.
  `build_search_index.js` generates the FlexSearch index from metadata.

- **Use uv + pyproject for deploy workflow**
  [`bade138`](https://github.com/Dicklesworthstone/ees/commit/bade138e843edd35de9a7efda1e5886e3217ce06)
  (2025-11-20) -- Switched from `pip install -r requirements.txt` to
  `uv sync` with Python 3.13 venv. Deploy script updated to use `uv run`.
  Dropped `requirements.txt`.

- **Fix dateutil timezone warnings and clean venv in deploy script**
  [`b3e6806`](https://github.com/Dicklesworthstone/ees/commit/b3e6806a81ddb2a77db5d40a27710d23c6e4f768)
  (2025-11-21) -- Suppressed `dateutil` timezone deprecation warnings in
  the builder; added venv cleanup step to the deploy script.

- **Restore missing code in search-worker.js**
  [`a301572`](https://github.com/Dicklesworthstone/ees/commit/a3015722553eec93a0439dabfa8c0c084b8aace7)
  (2025-11-21) -- Recovered 110 lines accidentally dropped from the worker
  during a prior edit.

- **Remove unused py_logging import alias**
  [`cb177e4`](https://github.com/Dicklesworthstone/ees/commit/cb177e42659f32f97d3f018d0dd6ba931995728a)
  (2026-02-11) -- Dropped shadowed `logging as py_logging` from
  `build_epstein_index.py`.

- **Dependency lockfile refresh**
  [`6384745`](https://github.com/Dicklesworthstone/ees/commit/638474503c17ecf38a5a4e9bb75834c3411b118f)
  (2026-01-18) -- Routine `uv.lock` update via library-updater workflow.

---

## Production Deployment

- **Deploy to GitHub Pages**
  [`dbd62b4`](https://github.com/Dicklesworthstone/ees/commit/dbd62b44561fe2b0aed4c66fe5a384715da2bcc6)
  (2025-11-21) -- Pushed the built site to the `gh-pages` branch: ships
  `index.html`, `search-worker.js`, `meta.sqlite` (~17 MB), `text.pack`
  (~42 MB), vendored JS/WASM (`sql.js`, `pako`, `fflate`, `flexsearch`),
  and `.nojekyll`. This made the explorer publicly available at
  <https://dicklesworthstone.github.io/ees/>.

---

## Licensing & Project Metadata

- **Add MIT License**
  [`8935dfe`](https://github.com/Dicklesworthstone/ees/commit/8935dfee62e698a93aa644151bf09ea7a05f5e15)
  (2026-01-21) -- Copyright (c) 2026 Jeffrey Emanuel.

- **Update license to MIT with OpenAI/Anthropic Rider**
  [`e48fd38`](https://github.com/Dicklesworthstone/ees/commit/e48fd380686d7f20ceedd19a2950f63dabea8260)
  (2026-02-21) -- Replaced plain MIT with a rider restricting use by
  OpenAI, Anthropic, and their affiliates without express written
  permission from Jeffrey Emanuel.

- **GitHub social preview image**
  [`d274f60`](https://github.com/Dicklesworthstone/ees/commit/d274f60411390e0670add6c9d623af407c429d1d)
  (2026-02-21) -- Added `gh_og_share_image.png` (1280x640) for consistent
  social media link previews.

---

## Documentation

- **Over-the-top promo README**
  [`3e9ed72`](https://github.com/Dicklesworthstone/ees/commit/3e9ed724377d4d04c08cb01f83631a7687672b9a)
  (2025-11-21) -- ASCII masthead, hype copy, feature rundown, usage notes,
  local dev commands, roadmap.

- **Docs: reflect lite-first index and on-demand text**
  [`c049092`](https://github.com/Dicklesworthstone/ees/commit/c049092692a6c38f95ea55182ccf851d31db8abf)
  (2025-11-21) -- README updated to describe the two-stage indexing
  strategy.

- **Docs: align README with meta/text split**
  [`ceedf9b`](https://github.com/Dicklesworthstone/ees/commit/ceedf9b18e6c669e34a201389018eb3b261396ad)
  (2025-11-21) -- README updated to describe `meta.sqlite` + `text.pack`
  architecture.

- **Update documentation and dependencies lockfile**
  [`8fb98be`](https://github.com/Dicklesworthstone/ees/commit/8fb98becba80d4b9872a78cdbb9f67ba41d83fd1)
  (2025-11-21) -- Major README rewrite (+413 lines); lockfile cleanup.

- **README: Brotli-to-Zlib transition, enhanced mobile details**
  [`82ec168`](https://github.com/Dicklesworthstone/ees/commit/82ec1684b2dc61f4986d715b150ad4277d97f7d5)
  (2025-11-21)

- **README: clarify mobile experience, navigation flowcharts**
  [`35362ee`](https://github.com/Dicklesworthstone/ees/commit/35362eea872f9a07e33dee7335c1906cdb5957f6)
  (2025-11-21)

---

## Housekeeping Commits

Several `chore: remove stray dirty state`, `chore: sync explorer html`,
and `chore: stabilize explorer html` commits appear throughout 2025-11-21
as artifacts of the rapid development session. These clean the working tree
between feature commits and contain no meaningful logic changes.

[`db3c959`](https://github.com/Dicklesworthstone/ees/commit/db3c9593bb3f58b8853d1e937f35b81b7eb466b0)
[`35d07f2`](https://github.com/Dicklesworthstone/ees/commit/35d07f250bbc685e75882e0fbe78dfa060a1cd6f)
[`77aef9a`](https://github.com/Dicklesworthstone/ees/commit/77aef9abe5d32faf6631afb663d199dd99733903)
[`ce11037`](https://github.com/Dicklesworthstone/ees/commit/ce110374de78bbf04aa3fd97672a98211d104f49)
[`d665378`](https://github.com/Dicklesworthstone/ees/commit/d6653786b231c5193a57c20df6d419703d75e25f)
[`0d11e65`](https://github.com/Dicklesworthstone/ees/commit/0d11e65d79a0aab67540c47bea08b9b84f2df454)
[`79be5c3`](https://github.com/Dicklesworthstone/ees/commit/79be5c31deefc50f9a390526d4dbb3d87afa0bcd)
[`792bef3`](https://github.com/Dicklesworthstone/ees/commit/792bef3f2987ab71de7b7ea15b2f10b588d9d434)
[`1a8d5ae`](https://github.com/Dicklesworthstone/ees/commit/1a8d5ae25b2f553b336beb77541d96234707bb04)
[`7a8c84a`](https://github.com/Dicklesworthstone/ees/commit/7a8c84a90ce15143600ce0ec50531f96f284d62f)
[`9aa97b2`](https://github.com/Dicklesworthstone/ees/commit/9aa97b226f6b041a4d3fcdb9b4781ec70d41dd49)
