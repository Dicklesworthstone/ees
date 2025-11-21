#!/usr/bin/env node
/* Build a precomputed FlexSearch Document index from data/meta.json */

const fs = require("fs");
const path = require("path");
const FlexSearch = require("flexsearch");

const { Document } = FlexSearch;

const DATA_DIR = path.join(__dirname, "data");

const MANIFEST_NAME = "index-export-manifest.json";

function main() {
  const metaPath = path.join(DATA_DIR, "meta.json");
  if (!fs.existsSync(metaPath)) {
    console.error("meta.json not found, run build_epstein_index.py first");
    process.exit(1);
  }

  const raw = fs.readFileSync(metaPath, "utf8");
  const docs = JSON.parse(raw);

  console.log(`Building FlexSearch Document index for ${docs.length} docs...`);

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

  const index = new Document(INDEX_CONFIG);

  for (const doc of docs) {
    index.add(doc);
  }

  const entries = [];
  index.export((key, data) => {
    entries.push([key, data]);
  }, { index: true, doc: false });

  const manifest = [];
  for (const [key, data] of entries) {
    const file = `index-export-${key}.json`;
    const payload = { key, data };
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(payload));
    manifest.push(file);
  }

  fs.writeFileSync(path.join(DATA_DIR, MANIFEST_NAME), JSON.stringify({ files: manifest }));

  console.log(`Wrote ${entries.length} index chunk files and manifest to data/`);
}

if (require.main === module) {
  main();
}
