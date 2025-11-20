#!/usr/bin/env node
/* Build a precomputed FlexSearch Document index from data/meta.json */

const fs = require("fs");
const path = require("path");
const FlexSearch = require("flexsearch");

const { Document } = FlexSearch;

const DATA_DIR = path.join(__dirname, "data");

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

  const exportedIndex = index.export({ index: true, doc: false });
  const exportedDocs = index.export({ index: false, doc: true });

  const out = {
    index: exportedIndex,
    docs: exportedDocs,
  };

  const outPath = path.join(DATA_DIR, "index-export.json");
  fs.writeFileSync(outPath, JSON.stringify(out));

  console.log(`Wrote precomputed index to ${outPath}`);
}

if (require.main === module) {
  main();
}

