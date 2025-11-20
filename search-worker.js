/* global self, importScripts */

let index = null;
let initPromise = null;

const INDEX_CONFIG = {
  document: {
    id: "id",
    index: [
      { field: "subject", tokenize: "forward" },
      { field: "from", tokenize: "forward" },
      { field: "to", tokenize: "forward" },
      { field: "search_text", tokenize: "forward" },
      { field: "domains", tokenize: "forward" },
    ],
    store: [
      "id",
      "message_id",
      "chunk_index",
      "chunk_count",
      "filename",
      "kind",
      "subject",
      "from",
      "to",
      "cc",
      "bcc",
      "participants",
      "domains",
      "date",
      "date_key",
      "thread_id",
      "preview",
    ],
  },
  tokenize: "forward",
  context: true,
};

function ensureIndex() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    try {
      if (typeof self.FlexSearch === "undefined") {
        importScripts(
          "https://cdn.jsdelivr.net/gh/nextapps-de/flexsearch@0.8.2/dist/flexsearch.bundle.min.js"
        );
      }
      const Document = self.FlexSearch.Document;
      index = new Document(INDEX_CONFIG);

      fetch("data/index-export.json")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load data/index-export.json");
          return res.json();
        })
        .then((payload) => {
          index.import(payload.index, { index: true, doc: false });
          index.import(payload.docs, { index: false, doc: true });
          resolve();
        })
        .catch((err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });

  return initPromise;
}

function searchBasic(field, query, limit) {
  const q = (query || "").trim();
  if (!q) return [];

  const max = typeof limit === "number" && limit > 0 ? limit : 500;

  if (field && field !== "all") {
    const results = index.search(q, { pluck: field, limit: max }) || [];
    return Array.isArray(results) ? results : [];
  }

  const results = index.search(q, { limit: max }) || [];
  const rank = new Map();

  for (const bucket of results) {
    if (!bucket || !bucket.result) continue;
    const list = bucket.result;
    for (let i = 0; i < list.length; i += 1) {
      const id = list[i];
      if (!rank.has(id)) rank.set(id, i);
      else if (i < rank.get(id)) rank.set(id, i);
    }
  }

  return Array.from(rank.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}

self.onmessage = (event) => {
  const { type, requestId, payload } = event.data || {};

  if (!type || !requestId) return;

  if (type === "init") {
    ensureIndex()
      .then(() => {
        self.postMessage({ type: "init-ok", requestId });
      })
      .catch((err) => {
        self.postMessage({ type: "error", requestId, error: String(err) });
      });
    return;
  }

  if (type === "search-basic") {
    ensureIndex()
      .then(() => {
        const { field, query, limit } = payload || {};
        const ids = searchBasic(field || "all", query, limit);
        self.postMessage({ type: "search-basic-result", requestId, ids });
      })
      .catch((err) => {
        self.postMessage({ type: "error", requestId, error: String(err) });
      });
  }
};

