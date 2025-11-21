/* global importScripts, self */

// Worker that loads the SQLite bundle, decompresses document text, builds the
// FlexSearch index, and services search + text retrieval requests.

let docsMeta = [];
let texts = new Map();
let index = null;
let initPromise = null;

const FLEXSEARCH_URL = "vendor/flexsearch.bundle.min.js";
const PAKO_URL = "vendor/pako.min.js";
const SQL_JS_VERSION = "1.11.0";
const SQL_JS_URL = "vendor/sql-wasm.js";
const SQLITE_PATH = "data/epstein.sqlite";

const INDEX_CONFIG = {
  document: {
    id: "id",
    index: [
      { field: "subject", tokenize: "forward" },
      { field: "from", tokenize: "forward" },
      { field: "to", tokenize: "forward" },
      { field: "text", tokenize: "forward" },
      { field: "domains", tokenize: "forward" }
    ],
    store: ["id", "filename", "kind", "from", "to", "subject", "date", "preview"]
  },
  tokenize: "forward",
  context: true
};

async function loadDeps() {
  importScripts(FLEXSEARCH_URL, PAKO_URL, SQL_JS_URL);
  if (typeof FlexSearch === "undefined") throw new Error("FlexSearch failed to load");
  if (typeof pako === "undefined") throw new Error("pako failed to load");
  if (typeof initSqlJs !== "function") throw new Error("sql.js failed to load");
  const SQL = await initSqlJs({ locateFile: (file) => `vendor/${file}` });
  return SQL;
}

async function loadDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await loadDeps();

    const resp = await fetch(SQLITE_PATH);
    if (!resp.ok) throw new Error(`Failed to fetch ${SQLITE_PATH}: ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buffer));

    const meta = [];
    const textMap = new Map();
    const decoder = new TextDecoder();

    const stmt = db.prepare(`
      SELECT id, message_id, chunk_index, chunk_count, filename, kind,
             subject, "from", "to", cc, bcc, participants, domains,
             date, date_key, thread_id, preview, text_compressed
      FROM docs
      ORDER BY id
    `);

    index = new FlexSearch.Document(INDEX_CONFIG);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      const participants = row.participants ? JSON.parse(row.participants) : [];
      const domains = row.domains ? JSON.parse(row.domains) : [];
      const compressed = row.text_compressed;
      const text = decoder.decode(pako.inflate(new Uint8Array(compressed)));

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
      textMap.set(row.id, text);
      index.add({ ...docMeta, text });
    }
    stmt.free();

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
    texts = textMap;

    return { docs: meta, timeline, people, threads };
  })();

  return initPromise;
}

function searchBasic(query, limit = 400, field = null) {
  const q = (query || "").trim();
  if (!q || !index) return docsMeta.map((d) => d.id).slice(0, limit);
  const res = index.search({ query: q, enrich: true, limit, index: field || undefined });
  const items = {};
  res.forEach((block) => {
    block.result.forEach((r) => {
      const idVal = typeof r === "object" && r !== null ? r.id : r;
      if (idVal !== undefined && idVal !== null) items[idVal] = true;
    });
  });
  return Object.keys(items).map((x) => parseInt(x, 10));
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
        const text = texts.get(id) || "";
        self.postMessage({ type: "text", requestId, id, text });
      })
      .catch((err) => {
        self.postMessage({ type: "error", requestId, error: String(err) });
      });
    return;
  }
};
