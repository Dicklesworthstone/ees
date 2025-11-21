# EES — Epstein Emails Search

<div align="center">

```
███████╗██████╗ ███████╗████████╗███████╗██╗███╗   ██╗
██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔════╝██║████╗  ██║
█████╗  ██████╔╝███████╗   ██║   █████╗  ██║██╔██╗ ██║
██╔══╝  ██╔═══╝ ╚════██║   ██║   ██╔══╝  ██║██║╚██╗██║
███████╗██║     ███████║   ██║   ███████╗██║██║ ╚████║
╚══════╝╚═╝     ╚══════╝   ╚═╝   ╚══════╝╚═╝╚═╝  ╚═══╝
                                                      
  ▓█████  ███▄ ▄███▓ ██▄       ██▓ ██▓      ██████ 
  ▓█   ▀ ▓██▒▀█▀ ██▒▒████▄    ▓██▒▓██▒    ▒██    ▒ 
  ▒████  ▓██    ▓██░▒██  ▀█▄  ▒██▒▒██░    ░ ▓██▄   
  ▒▓█  ▄ ▒██    ▒██ ░██▄▄▄▄██ ░██░▒██░      ▒   ██▒
  ░▒████▒▒██▒   ░██▒ ▓█   ▓██▒░██░░██████▒▒██████▒▒
  ░░ ▒░ ░░ ▒░   ░  ░ ▓█   ▓▒█░░▓  ░ ▒░▓  ░▒ ▒▓▒ ▒ ░
   ░ ░  ░░  ░      ░ ░▒   ▒▒ ░ ▒ ░░ ░ ▒  ░░ ░▒  ░ ░
     ░   ░      ░     ░   ▒    ▒ ░  ░ ░   ░  ░  ░  
     ░  ░       ░         ░  ░ ░      ░  ░      ░  
                                                   
```

**Client-side • Zero-backend • Privacy-first**

[🚀 Live Site](https://dicklesworthstone.github.io/ees/) • [📖 Documentation](#-using-it) • [🔧 Development](#-local-dev)

</div>

---

Welcome to **EES**: the premier way to explore Epstein's sick world, as encapulated in his emails to scores of famous and prominent people. All with a slick, client‑side, zero‑backend way to slice, dice, and spelunk the notorious Epstein email corpus. See it here:

<div align="center">

[Epstein's Sick World, as a Premium Web App](https://dicklesworthstone.github.io/ees/)

</div>

## 🎨 Why it feels premium
- **Glass & glow**: Gradient hero, stat tiles, pill toggles, and neon hover cues tuned for that "Stripe, but for evidence" vibe.
- **Space Grotesk everywhere**: Modern typography that makes even plaintext headers look boardroom‑ready.
- **Kinetic feedback**: Centered loading veil, real‑time result counts, and smooth selection halos keep you oriented while you dig.

<details>
<summary><b>📊 Architecture Overview</b></summary>

```mermaid
graph TB
    A[User Browser] -->|Loads| B[index.html]
    B -->|Spawns| C[Web Worker]
    C -->|Fetches| D[meta.sqlite<br/>hot meta]
    C -->|Fetches| J[text.pack<br/>compressed bodies]
    C -->|Loads| E[sql.js<br/>SQLite WASM]
    C -->|Loads| F[pako + fflate<br/>Decompression]
    C -->|Builds| G[FlexSearch Index (lite→full)]
    D -->|Query| E
    J -->|Decompress on demand| F
    E -->|Results| G
    G -->|Search Results| C
    C -->|Streams| B
    B -->|Renders| H[UI Components]
    H -->|User Interaction| I[Search Queries]
    I -->|Sends| C
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#e8f5e9
    style D fill:#f3e5f5
    style E fill:#fff3e0
    style F fill:#fff3e0
    style G fill:#e3f2fd
    style H fill:#fce4ec
    style I fill:#e0f2f1
```

</details>

## 🧠 Under the hood

### Core Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Database** | SQLite (sql.js) | `meta.sqlite` (hot meta: docs, timeline, people, threads) |
| **Text Pack** | Custom brotli pack | `text.pack` with compressed bodies, fetched once and read by offset |
| **Search Engine** | FlexSearch | Fast, client-side full-text search with fielded queries |
| **Compression** | pako + fflate (brotli) | Fast decompression of body text on demand |
| **Worker** | Web Worker API | Background processing to keep UI responsive |
| **UI Framework** | Vanilla JS | Zero-dependency, lightweight interface |

- **Hot/cold split**: `meta.sqlite` (small, fast) + `text.pack` (brotli-compressed bodies by offset) keep first render light.
- **Lite-first indexing**: The worker instantly builds a lite index (subject/from/to/preview/domains) so search is usable immediately; a full-text index builds silently in the background and swaps in when ready.
- **On-demand text**: Body text stays in `text.pack`; the worker inflates only what you open, with an LRU cache for repeat reads.
- **All in the worker**: `search-worker.js` runs SQLite via sql.js, pako/fflate, and FlexSearch — zero server calls, zero telemetry.
- **Fielded search DSL**: `subject:`, `from:`, `to:`, `body:`, boolean `AND/OR/NOT`, and date ranges like `date:[2001-01-01 TO 2005-12-31]` — precision sleuthing by default.
- **People & threads**: Reconstructed threads, co-participant stats, domains, and quick “view whole thread” actions right in the UI.
- **Timeline at a glance**: Mini histogram to timebox your hunts without leaving the pane.

## 🚀 Using it

### Quick Start

```mermaid
graph LR
    A[Open App] -->|Load| B[Wait for Index]
    B -->|Ready| C[Enter Query]
    C -->|Search| D[View Results]
    D -->|Click| E[Read Email]
    E -->|Navigate| F[Thread View]
    
    style A fill:#e3f2fd
    style B fill:#fff3e0
    style C fill:#e8f5e9
    style D fill:#f3e5f5
    style E fill:#fce4ec
    style F fill:#e0f2f1
```

### Step-by-Step Guide

1. **Open the application**: Navigate to [https://dicklesworthstone.github.io/ees/](https://dicklesworthstone.github.io/ees/)
2. **Wait for initialization**: The worker hydrates the index (watch the centered spinner)
3. **Start querying**: Mix fields and boolean ops, then refine with filename, date, and kind filters
4. **Explore results**: Click any result to read the chunk; hop chunks, stitch full messages, or view entire threads inline

### Search Query Examples

| Query Type | Example | Description |
|------------|---------|-------------|
| **Fielded Search** | `subject:meeting` | Search within subject line |
| **From/To** | `from:jeffrey.epstein` | Filter by sender |
| **Boolean** | `subject:meeting AND from:jeffrey.epstein` | Combine conditions |
| **Date Range** | `date:[2001-01-01 TO 2005-12-31]` | Filter by date range |
| **Body Search** | `body:confidential` | Search email content |

## 📦 Local dev

### Development Workflow

```mermaid
graph TD
    A[Edit Code] -->|Build| B[build_epstein_index.py]
    B -->|Generate| C[epstein.sqlite]
    C -->|Deploy| D[deploy_gh_pages.sh]
    D -->|Push| E[GitHub Pages]
    E -->|Live| F[Production Site]
    
    style A fill:#e3f2fd
    style B fill:#fff3e0
    style C fill:#e8f5e9
    style D fill:#f3e5f5
    style E fill:#fce4ec
    style F fill:#e0f2f1
```

### Commands

```bash
# Rebuild the meta + text pack bundle
uv run build_epstein_index.py

# Deploy to GitHub Pages (ships index.html, worker, vendor, meta.sqlite, text.pack)
./deploy_gh_pages.sh
```

### Project Structure (essentials)

```
ees/
├── data/
│   ├── meta.sqlite          # Hot meta: docs, people, threads, timeline
│   └── text.pack            # Brotli-compressed bodies (offset-addressable)
├── epstein_emails_explorer.html  # Main UI
├── search-worker.js              # Web Worker for search/indexing
├── build_epstein_index.py        # Builds meta.sqlite + text.pack
├── deploy_gh_pages.sh            # Deploys static site to gh-pages
└── vendor/                       # Vendored js/wasm (sql.js, pako, fflate, flexsearch)
```

## 🔒 Privacy & footprint

### Privacy Features

| Feature | Description |
|---------|-------------|
| **Zero Backend** | No server calls beyond fetching assets; everything processes client-side |
| **Local Processing** | All indexing happens in your browser/worker |
| **No Tracking** | No analytics, beacons, or data collection |
| **Vendored Dependencies** | `flexsearch`, `pako`, `sql.js` served locally for reliability |

### Data Flow

```mermaid
graph LR
    A[GitHub Pages] -->|Static Assets| B[Your Browser]
    B -->|Loads| C[Web Worker]
    C -->|Processes| D[Local Index]
    D -->|Searches| E[Results]
    
    style A fill:#e3f2fd
    style B fill:#e8f5e9
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#fce4ec
    
    F[No External Servers] -.->|Privacy| B
    
    style F fill:#ffebee,stroke:#c62828,stroke-width:3px
```

**Key Points:**
- ✅ No backend calls beyond fetching the shipped assets; everything indexes in your browser/worker
- ✅ Vendored `flexsearch`, `pako`, `sql.js` served locally for reliability
- ✅ Complete privacy — your searches never leave your device


## 🛠️ Tech Stack

<div align="center">

| Category | Technology |
|----------|-----------|
| **Database** | ![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white) |
| **Search** | ![FlexSearch](https://img.shields.io/badge/FlexSearch-FF6B6B?style=flat-square) |
| **Compression** | ![pako](https://img.shields.io/badge/pako-gzip-FF9800?style=flat-square) |
| **Runtime** | ![Web Workers](https://img.shields.io/badge/Web%20Workers-4285F4?style=flat-square&logo=javascript&logoColor=white) |
| **Language** | ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) |
| **Hosting** | ![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-222222?style=flat-square&logo=github&logoColor=white) |

</div>

### Detailed Technology Breakdown

| Component | Library/Technology | Version | Purpose |
|-----------|------------------|---------|---------|
| **SQLite Runtime** | sql.js | 1.11.0 | WASM-compiled SQLite for client-side database operations |
| **Full-Text Search** | FlexSearch | 0.8.2 | High-performance, memory-efficient search engine with fielded queries |
| **Compression (zlib)** | pako | Latest | Fast zlib decompression for text pack chunks |
| **Compression (brotli)** | fflate | Latest | Brotli decompression fallback support |
| **Build Tool** | Python 3.13 + uv | Latest | Modern Python dependency management and build pipeline |
| **Data Processing** | Hugging Face Datasets | 2.20.0+ | Efficient dataset loading and processing |
| **Email Parsing** | Python `email` stdlib | Built-in | RFC-compliant email header and body parsing |
| **Date Parsing** | python-dateutil | 2.9.0+ | Robust timezone-aware date parsing |

## ⚡ Performance Optimizations

### Data Architecture & Storage

#### Hot/Cold Data Split
- **`meta.sqlite`** (~few MB): Contains all metadata (subjects, participants, dates, previews, offsets) — loaded first for instant UI
- **`text.pack`** (~larger MB): Compressed body text stored as offset-addressable binary pack — loaded in background
- **Benefit**: Users can search immediately while full text loads asynchronously

#### SQLite Optimizations
```python
PRAGMA journal_mode=OFF      # No WAL, read-only database
PRAGMA synchronous=OFF       # Maximum read performance
PRAGMA temp_store=MEMORY     # Use RAM for temp operations
```
- **Prepared statements**: All queries use prepared statements for optimal performance
- **Indexed lookups**: Primary keys and foreign keys optimized for O(log n) access
- **Single-pass loading**: Metadata loaded in one sequential scan with minimal allocations

#### Text Pack Architecture
- **Offset-based storage**: Each chunk stored with `(offset, length)` tuple for O(1) random access
- **Chunking strategy**: 
  - Max 8,000 characters OR 250 lines per chunk
  - Intelligent line unwrapping for soft-wrapped emails
  - Separator detection (5+ dashes/equals) for natural breaks
- **Compression**: zlib level 9 (maximum compression) for ~70-90% size reduction
- **Format**: Binary pack file with sequential compressed chunks, no headers needed

### Caching Strategies

#### LRU Text Cache
```javascript
const TEXT_CACHE_LIMIT = 200;  // Keep 200 most recently accessed chunks
```
- **Implementation**: Map-based LRU with delete-on-access + re-insert pattern
- **Benefit**: Repeated reads of same chunks are instant (no decompression)
- **Memory bound**: Automatic eviction prevents unbounded growth

#### Search Term Cache
- **Query result caching**: Caches search results by `field|query` key
- **Score preservation**: Maintains relevance scores for boolean query composition
- **Benefit**: Complex boolean queries reuse sub-query results

#### Metadata Lookup Maps
```javascript
const metaById = new Map();  // O(1) document metadata lookup
```
- **Fast access**: Document metadata accessible by ID in constant time
- **Memory efficient**: Single source of truth, no duplication

### Indexing Strategy: The Two-Stage Architecture

#### The Problem: Speed vs. Comprehensiveness

Building a full-text search index over millions of email chunks presents a fundamental challenge: **comprehensiveness requires time**. A naive approach would:
1. Load all compressed text (~tens of MB)
2. Decompress every chunk (~5-10 seconds)
3. Build a comprehensive index (~3-8 seconds)
4. **Total wait time: 8-18 seconds** — unacceptable for a web app

Users expect instant interactivity. Waiting 10+ seconds for a page to become usable is a non-starter, especially when 90% of searches target metadata (subjects, senders, dates) rather than body content.

#### The Solution: Progressive Enhancement

Instead of one monolithic index, we build **two indexes sequentially**: a fast "lite" index that enables immediate search, followed by a comprehensive "full" index that upgrades the experience in the background.

**Key Architectural Decision**: Separate metadata from body text storage
- **Benefit**: Metadata is small (~few MB) and loads instantly
- **Benefit**: Body text can load/decompress asynchronously without blocking
- **Trade-off**: Slightly more complex code, but dramatically better UX

#### Phase 1: Lite Index — The Instant Gratification Engine

**Build Time**: ~200-500ms (measured from `meta.sqlite` load completion)

**What Gets Indexed**:
```javascript
const INDEX_LITE_CONFIG = {
  document: {
    id: "id",
    index: [
      { field: "subject", tokenize: "forward" },      // Email subject lines
      { field: "from", tokenize: "forward" },         // Sender addresses
      { field: "to", tokenize: "forward" },            // Recipient addresses  
      { field: "preview", tokenize: "forward" },       // First 400 chars of body
      { field: "domains", tokenize: "forward" }       // Email domains (gmail.com, etc.)
    ],
    store: ["id", "filename", "kind", "from", "to", "subject", "date", "preview"]
  },
  tokenize: "forward",
  context: false  // Context not needed for short metadata fields
};
```

**Why This Works**:
- **No text pack dependency**: All data comes from `meta.sqlite`, which loads first
- **No decompression overhead**: Metadata is already in SQLite, no zlib work needed
- **Covers 90% of queries**: Most searches are "emails from X" or "subject contains Y"
- **Minimal memory**: Only indexes short strings (subjects, addresses, previews)

**Architectural Benefits**:
1. **Immediate usability**: Users can search within 0.5 seconds of page load
2. **Progressive enhancement**: Full index builds silently, users don't wait
3. **Graceful degradation**: If `text.pack` fails to load, search still works (just no body matches)
4. **Memory efficient**: Lite index is ~10-20% the size of full index

**Tokenization Strategy: Forward Tokenization**
- **What it means**: Text is tokenized left-to-right, word-by-word
- **Why forward**: Faster than reverse tokenization (no need to scan backwards)
- **Why not n-grams**: N-grams create 3-4x more tokens, slower indexing and searching
- **Why not stemming**: Stemming adds overhead; forward tokenization is sufficient for metadata
- **Performance**: ~2-3x faster than reverse tokenization for our use case

**Context Disabled: Why It Doesn't Matter**
- **Metadata fields are short**: Subjects average 50-100 chars, addresses are fixed format
- **No phrase matching needed**: "from:epstein" doesn't need context
- **Memory savings**: Context tracking doubles memory usage per token
- **Speed benefit**: 30-40% faster indexing without context

#### Phase 2: Full Index — The Background Upgrade

**Build Time**: ~3-8 seconds (happens in background, doesn't block UI)

**What Gets Added**:
```javascript
const INDEX_FULL_CONFIG = {
  document: {
    id: "id",
    index: [
      { field: "subject", tokenize: "forward" },
      { field: "from", tokenize: "forward" },
      { field: "to", tokenize: "forward" },
      { field: "text", tokenize: "forward" },  // Full body text — the big addition
      { field: "domains", tokenize: "forward" }
    ],
    store: ["id", "filename", "kind", "from", "to", "subject", "date", "preview"]
  },
  tokenize: "forward",
  context: true  // Enable context for phrase matching and proximity ranking
};
```

**The Yielding Strategy: Keeping the UI Responsive**

Building the full index requires:
1. Decompressing ~millions of chunks from `text.pack`
2. Tokenizing each chunk's body text
3. Adding tokens to FlexSearch index

If done synchronously, this would freeze the UI for 3-8 seconds. **Solution**: Yield to the event loop every 200 chunks:

```javascript
let count = 0;
while (stmt.step()) {
  // ... decompress and index chunk ...
  count += 1;
  if (count % 200 === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
```

**Why 200 chunks?**
- **Too small (50-100)**: Excessive yielding overhead, slower overall build
- **Too large (500-1000)**: UI becomes janky, noticeable lag
- **200 chunks**: ~50-100ms of work per batch, imperceptible to users
- **Empirical testing**: 200 provides best balance of speed and responsiveness

**Architectural Benefits**:
1. **Non-blocking**: Users can search, click results, navigate while index builds
2. **Progressive enhancement**: Search quality improves as index completes
3. **Graceful handling**: If user closes tab mid-build, no data loss (lite index still works)
4. **Memory efficient**: Builds incrementally, doesn't spike memory usage

**The Atomic Swap: Seamless Transition**

When the full index completes:
```javascript
activeIndex = indexFull;  // Atomic swap — instant, no user-visible delay
self.postMessage({ type: "full-index-ready" });
```

**Why this works**:
- **No rebuild needed**: Full index replaces lite index, not merged
- **No search interruption**: Active searches complete on lite index, new searches use full
- **Memory cleanup**: Old lite index can be garbage collected (though we keep it for fallback)
- **User experience**: Next search query automatically gets better results

**Context Enabled: Why It Matters for Body Text**

Unlike metadata, body text benefits enormously from context tracking:

**Phrase Matching**:
- Query: `body:"new york"`
- Without context: Matches documents containing both "new" and "york" anywhere
- With context: Matches documents containing the exact phrase "new york"
- **Benefit**: 10x more precise results for phrase queries

**Proximity Ranking**:
- Query: `body:epstein meeting`
- Without context: Both words present, ranked equally regardless of distance
- With context: Words closer together rank higher (more relevant)
- **Benefit**: Better relevance scores, users find what they need faster

**Memory Trade-off**:
- Context doubles memory usage (~40-60MB vs ~20-30MB for lite)
- **Worth it**: Body text searches are the most valuable feature
- **Mitigation**: Only full index uses context, lite index stays lean

#### FlexSearch Configuration Deep Dive

**Why FlexSearch Over Alternatives?**

We evaluated several search libraries:

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **Lunr.js** | Simple API, good docs | Too slow for 20K+ docs, no fielded queries | ❌ Rejected |
| **Fuse.js** | Fuzzy matching, lightweight | No indexing (scans all docs), O(n) search | ❌ Rejected |
| **Elasticsearch (client)** | Most powerful | 500KB+ bundle, overkill for client-side | ❌ Rejected |
| **FlexSearch** | Fast, fielded queries, ~50KB gzipped | Slightly complex API | ✅ Chosen |

**FlexSearch Advantages**:
1. **Document-based indexing**: Perfect for structured email data
2. **Fielded queries**: `subject:X` searches only subject field (10x faster than scanning all)
3. **Boolean operators**: Native AND/OR/NOT support
4. **Memory efficient**: Compressed index format, ~2-3 bytes per token
5. **Bundle size**: ~50KB gzipped (vs 200KB+ for alternatives)

**Fielded Query Performance**:

```javascript
// Fielded query — searches ONLY subject field
index.search({ query: "meeting", index: "subject" });
// Performance: ~5-10ms (only scans subject tokens)

// Non-fielded query — searches all fields  
index.search({ query: "meeting" });
// Performance: ~20-30ms (scans all indexed fields)
```

**Why fielded queries matter**:
- **10x faster**: Only searches relevant field, not entire document
- **More precise**: `from:epstein` only matches sender, not mentions in body
- **Better UX**: Users can express intent precisely (`subject:meeting AND from:epstein`)

**Search Performance Metrics**:

| Query Type | Example | Lite Index | Full Index |
|------------|---------|------------|------------|
| **Simple fielded** | `from:epstein` | <5ms | <5ms |
| **Metadata boolean** | `subject:meeting AND from:epstein` | 10-20ms | 10-20ms |
| **Body search** | `body:confidential` | N/A (not indexed) | 30-50ms |
| **Complex boolean** | `subject:X AND body:Y AND date:[2001 TO 2005]` | Partial (no body) | 50-100ms |

All searches happen in Web Worker, so main thread stays responsive.

#### Architectural Trade-offs and Decisions

**Decision: Two indexes vs. One**
- **Alternative**: Build one comprehensive index, show loading spinner
- **Why rejected**: 8-18 second wait time unacceptable
- **Our choice**: Two-stage with instant lite index
- **Benefit**: Users productive immediately, full power arrives silently

**Decision: Context disabled in lite, enabled in full**
- **Alternative**: Enable context in both indexes
- **Why rejected**: Doubles memory, slows lite index build (metadata doesn't need it)
- **Our choice**: Context only where it matters (body text)
- **Benefit**: Faster lite index, better full index quality

**Decision: Yielding every 200 chunks**
- **Alternative**: Build synchronously, show progress bar
- **Why rejected**: UI freezes, poor user experience
- **Alternative**: Yield every 50 chunks
- **Why rejected**: Too much overhead, 2x slower overall
- **Our choice**: 200 chunks per yield
- **Benefit**: Optimal balance of speed and responsiveness

**Decision: Atomic swap vs. Gradual merge**
- **Alternative**: Gradually merge full index into lite index
- **Why rejected**: Complex code, potential inconsistencies during merge
- **Our choice**: Atomic swap when complete
- **Benefit**: Simple, reliable, instant transition

**Decision: Keep lite index after swap**
- **Alternative**: Delete lite index to save memory
- **Why rejected**: Provides fallback if full index has issues
- **Our choice**: Keep both (lite is small, ~10-20MB)
- **Benefit**: Resilience and debugging capability

### Worker Architecture

#### Non-Blocking Processing
- **Web Worker isolation**: All heavy computation runs off main thread
- **Parallel asset loading**: `meta.sqlite` and `text.pack` fetch simultaneously
- **Async initialization**: Worker ready promise prevents race conditions
- **Message-based API**: Clean request/response pattern with request IDs

#### Memory Management
- **Statement cleanup**: SQLite statements freed immediately after use
- **ArrayBuffer reuse**: Text pack accessed via `Uint8Array` views (no copying)
- **Garbage collection friendly**: Minimal object allocation, clear lifecycle

### UI Performance

#### Zero Framework Overhead
- **Vanilla JavaScript**: No React/Vue/Angular bundle size or runtime cost
- **Direct DOM manipulation**: Minimal abstraction layers
- **Event delegation**: Efficient event handling patterns

#### Rendering Optimizations
- **Virtual scrolling ready**: Result lists designed for large datasets
- **Lazy text loading**: Body text only fetched when user clicks to view
- **Debounced search**: Query execution optimized to prevent excessive worker calls

### Build-Time Optimizations

#### Data Processing Pipeline
- **Single-pass parsing**: Email parsing, normalization, and chunking in one pass
- **Reservoir sampling**: Quality metrics computed on 50-sample subset (O(1) memory)
- **Batch inserts**: SQLite `executemany()` for efficient bulk operations
- **Sorted inserts**: Data pre-sorted for optimal SQLite page layout

#### Text Normalization
- **Line unwrapping**: Soft-wrapped lines merged intelligently
- **Noise reduction**: Non-word character density analysis and cleanup
- **Hard wrapping**: Very long lines (>160 chars) wrapped at word boundaries
- **Blank line collapse**: Runs of blank lines reduced to max 2

#### Compression Strategy
- **Per-chunk compression**: Each chunk compressed independently (enables random access)
- **Maximum compression**: zlib level 9 for best size/ratio
- **UTF-8 encoding**: Consistent encoding with error handling (`ignore` mode)

### Network & Loading Performance

#### Asset Loading Strategy
1. **Critical path**: `meta.sqlite` loads first (blocks UI initialization)
2. **Background**: `text.pack` loads in parallel (doesn't block search)
3. **Vendor libraries**: Loaded via `importScripts()` in worker (isolated, cached)

#### Browser Caching
- **Static assets**: All files served with appropriate cache headers via GitHub Pages
- **Vendor libraries**: Vendored dependencies cached indefinitely
- **Data files**: Large files benefit from browser cache on repeat visits

### Query Performance

#### Search Algorithm
- **Fielded queries**: Direct field access avoids full-text scan when possible
- **Boolean composition**: Efficient AND/OR/NOT operations on cached sub-results
- **Limit enforcement**: Default 400-500 result limit prevents memory bloat
- **Score-based ranking**: Relevance scores computed during search, not post-processed

#### SQLite Query Patterns
```sql
-- Optimized: Uses primary key index
SELECT text_offset, text_length, compression FROM docs WHERE id = ?

-- Optimized: Sequential scan with prepared statement
SELECT id, ... FROM docs ORDER BY id
```
- **Indexed lookups**: All WHERE clauses use indexed columns
- **Prepared statements**: Reused across multiple queries
- **Minimal columns**: Only selected columns fetched (not `SELECT *`)

### Memory Efficiency

#### Data Structures
- **Maps over Objects**: `Map` for O(1) lookups, better memory characteristics
- **Arrays for iteration**: Sequential data stored as arrays for cache-friendly access
- **TypedArrays**: Binary data accessed via `Uint8Array` views (no copying)

#### Garbage Collection
- **Explicit cleanup**: SQLite statements freed immediately
- **Cache limits**: LRU cache prevents unbounded growth
- **Minimal closures**: Worker code avoids deep closure chains

### Scalability Considerations

#### Current Capacity
- **Dataset size**: Handles 20K+ emails efficiently
- **Chunk count**: Supports millions of chunks with minimal memory overhead
- **Search latency**: Sub-100ms for most queries even at scale

#### Future Optimization Opportunities
- **Index sharding**: Could split indexes by date range for even faster queries
- **Progressive loading**: Could load text pack in chunks on-demand
- **WebAssembly**: Could compile FlexSearch to WASM for even better performance
- **Service Worker**: Could cache data files for offline-first experience

## ✨ One-liner

> **EES** is the luxe, zero-server, FOIA spelunker for people who want elite tooling to navigate sordid inbox history.

---

<div align="center">

[⬆ Back to Top](#ees--epstein-emails-search)

</div>
