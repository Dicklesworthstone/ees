/* global importScripts, self */

// Worker that loads the SQLite bundle, decompresses document text, builds the
// FlexSearch index, and services search + text retrieval requests.

let docsMeta = [];
let indexLite = null;
let indexFull = null;
let activeIndex = null;
let initPromise = null;
let fullIndexPromise = null;
let dbInstance = null;
let textPack = null;
let textPackPromise = null;
const metaById = new Map();
// Simple LRU cache for decompressed texts
const textCache = new Map();
const TEXT_CACHE_LIMIT = 200;

// ... (imports and config remain the same) ...

async function loadDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await loadDeps();

    // Optimization: Fetch ONLY meta.sqlite first to get the UI running ASAP
    const metaResp = await fetch(META_DB_PATH);
    if (!metaResp.ok) throw new Error(`Failed to fetch ${META_DB_PATH}: ${metaResp.status}`);
    const metaBuf = await metaResp.arrayBuffer();
    
    // Start text.pack fetch in the background
    textPackPromise = fetch(TEXT_PACK_PATH)
      .then(resp => {
        if (!resp.ok) throw new Error(`Failed to fetch ${TEXT_PACK_PATH}: ${resp.status}`);
        return resp.arrayBuffer();
      })
      .then(buf => {
        textPack = buf;
        // Once text pack is ready, we can start the full index build
        if (dbInstance && docsMeta.length > 0) {
            fullIndexPromise = buildFullIndex(dbInstance, new TextDecoder(), docsMeta).catch((err) => {
              self.postMessage({ type: "full-index-error", error: String(err) });
            });
        }
        return buf;
      })
      .catch(err => {
        console.error("Failed to load text pack:", err);
        // We don't throw here to avoid breaking the lite UI, 
        // but getTextById will fail if called
      });

    const db = new SQL.Database(new Uint8Array(metaBuf));
    dbInstance = db;

    const meta = [];
    // ... (rest of the metadata extraction logic remains the same) ...

    const stmt = db.prepare(`
      SELECT id, message_id, chunk_index, chunk_count, filename, kind,
             subject, "from", "to", cc, bcc, participants, domains,
             date, date_key, thread_id, preview
      FROM docs
      ORDER BY id
    `);

    indexLite = new FlexSearch.Document(INDEX_LITE_CONFIG);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      const participants = row.participants ? JSON.parse(row.participants) : [];
      const domains = row.domains ? JSON.parse(row.domains) : [];

      const docMeta = {
        id: row.id,
        message_id: row.message_id,
        chunk_index: row.chunk_index,
        chunk_count: row.chunk_count,
        filename: row.filename,
        kind: row.kind,
        subject: row.subject,
        from: row["from"],
        to: row["to"],
        cc: row.cc,
        bcc: row.bcc,
        participants,
        domains,
        date: row.date,
        date_key: row.date_key,
        thread_id: row.thread_id,
        preview: row.preview,
      };

      meta.push(docMeta);
      metaById.set(docMeta.id, docMeta);
      indexLite.add({ ...docMeta, preview: docMeta.preview || "" });
    }
    stmt.free();

    activeIndex = indexLite;

    const timeline = [];
    const tStmt = db.prepare("SELECT date, count FROM timeline ORDER BY date");
    while (tStmt.step()) {
      const r = tStmt.getAsObject();
      timeline.push({ date: r.date, count: r.count });
    }
    tStmt.free();

    const people = [];
    const pStmt = db.prepare("SELECT address, display_name, domain, message_count, sent_count, received_count, first_date, last_date, top_co FROM people ORDER BY message_count DESC");
    while (pStmt.step()) {
      const r = pStmt.getAsObject();
      people.push({
        address: r.address,
        display_name: r.display_name,
        domain: r.domain,
        message_count: r.message_count,
        sent_count: r.sent_count,
        received_count: r.received_count,
        first_date: r.first_date,
        last_date: r.last_date,
        top_co: r.top_co ? JSON.parse(r.top_co) : [],
      });
    }
    pStmt.free();

    const threads = [];
    const thStmt = db.prepare("SELECT thread_id, normalized_subject, participants, message_ids, kinds, start_date, end_date FROM threads ORDER BY start_date");
    while (thStmt.step()) {
      const r = thStmt.getAsObject();
      threads.push({
        thread_id: r.thread_id,
        normalized_subject: r.normalized_subject,
        participants: r.participants ? JSON.parse(r.participants) : [],
        message_ids: r.message_ids ? JSON.parse(r.message_ids) : [],
        kinds: r.kinds ? JSON.parse(r.kinds) : [],
        start_date: r.start_date,
        end_date: r.end_date,
      });
    }
    thStmt.free();

    docsMeta = meta;

    // NOTE: We do NOT await fullIndexPromise here anymore. 
    // It starts when textPackPromise resolves.

    return { docs: meta, timeline, people, threads, index_state: "lite" };
  })();

  return initPromise;
}

// ... (searchBasic remains the same) ...

function pruneTextCache() {
  while (textCache.size > TEXT_CACHE_LIMIT) {
    const firstKey = textCache.keys().next().value;
    if (firstKey === undefined) break;
    textCache.delete(firstKey);
  }
}

async function getTextById(id) {
  const key = String(id);
  if (textCache.has(key)) {
    const val = textCache.get(key);
    // refresh recency
    textCache.delete(key);
    textCache.set(key, val);
    return val;
  }
  if (!dbInstance) throw new Error("DB not loaded");

  // Wait for text pack if it's still downloading
  if (!textPack) {
    if (textPackPromise) {
        await textPackPromise;
    }
    if (!textPack) throw new Error("Text pack not available yet");
  }

  const stmt = dbInstance.prepare("SELECT text_offset, text_length, compression FROM docs WHERE id = ?");
  stmt.bind([id]);
  let text = "";
  if (stmt.step()) {
    const row = stmt.getAsObject();
    const offset = row.text_offset;
    const length = row.text_length;
    const compression = row.compression || "br";
    if (offset !== null && offset !== undefined && length !== null && length !== undefined) {
      const slice = new Uint8Array(textPack, offset, length);
      if (compression === "br") {
        const inflated = fflate.brotliDecompress(slice);
        text = new TextDecoder().decode(inflated);
      } else {
        text = new TextDecoder().decode(pako.inflate(slice));
      }
    }
  }
  stmt.free();
  textCache.set(key, text);
  pruneTextCache();
  return text;
}

async function buildFullIndex(db, decoder, meta) {
  indexFull = new FlexSearch.Document(INDEX_FULL_CONFIG);
  const stmt = db.prepare("SELECT id, text_offset, text_length, compression FROM docs ORDER BY id");
  let count = 0;
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const offset = row.text_offset;
    const length = row.text_length;
    const compression = row.compression || "br";
    let text = "";
    if (offset !== null && offset !== undefined && length !== null && length !== undefined) {
      const slice = new Uint8Array(textPack, offset, length);
      if (compression === "br") {
        const inflated = fflate.brotliDecompress(slice);
        text = decoder.decode(inflated);
      } else {
        text = decoder.decode(pako.inflate(slice));
      }
    }
    const docMeta = metaById.get(row.id);
    if (docMeta) {
      indexFull.add({ ...docMeta, text });
    }
    count += 1;
    // Yield periodically to keep the worker responsive
    if (count % 200 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  stmt.free();
  activeIndex = indexFull;
  self.postMessage({ type: "full-index-ready", requestId: null });
}

self.onmessage = (event) => {
  const { type, requestId, payload } = event.data || {};
  if (!type) return;

  if (type === "init") {
    loadDatabase()
      .then((data) => {
        self.postMessage({ type: "init-complete", requestId, data });
      })
      .catch((err) => {
        self.postMessage({ type: "error", requestId, error: String(err) });
      });
    return;
  }

  if (type === "search-basic") {
    loadDatabase()
      .then(() => {
        const { query, limit, field } = payload || {};
        const ids = searchBasic(query, limit || 400, field || null);
        self.postMessage({ type: "search-basic-result", requestId, ids });
      })
      .catch((err) => {
        self.postMessage({ type: "error", requestId, error: String(err) });
      });
    return;
  }

  if (type === "get-text") {
    loadDatabase()
      .then(() => {
        const id = payload?.id;
        return getTextById(id).then((text) => {
          self.postMessage({ type: "text", requestId, id, text });
        });
      })
      .catch((err) => {
        self.postMessage({ type: "error", requestId, error: String(err) });
      });
    return;
  }
};
